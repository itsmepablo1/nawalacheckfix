import * as dns from "dns";

export const DEFAULT_DNS_TIMEOUT = 5000;

/**
 * Known block-page IPs returned by Indonesian ISP DNS servers
 * when a domain is blocked (DNS hijacking/redirect).
 *
 * How these were discovered:
 * - IndiHome (118.98.44.10) returns 36.86.63.x for blocked domains
 * - Nawala (180.131.144.144) is not accessible from outside Indonesia
 */
const KNOWN_BLOCK_IPS = new Set([
    // IndiHome / Telkom block page cluster
    "36.86.63.182",
    "36.86.63.183",
    "36.86.63.184",
    "36.86.63.185",
    "36.86.63.186",
    "36.86.63.187",
    "36.86.63.188",
    "36.86.63.189",
    // Nawala / TrustPositif block page
    "180.131.144.144",
    "180.131.144.145",
    // Telkom Internet Sehat
    "118.98.44.10",
    "118.98.44.100",
    // Common Internet Positif IPs
    "180.250.113.10",
    "203.130.196.155",
]);

// Reference DNS to compare against (Google Public DNS — unfiltered)
const REFERENCE_DNS = "8.8.8.8";

export type DnsCheckOutput = {
    status: "AMAN" | "BLOCKIR" | "TIMEOUT";
    resolved_ips: string[];
    reference_ips: string[];
    latency_ms: number;
    error_code: string | null;
    dns_server: string;
    note?: string;
};

/** Resolve a domain using a specific DNS server */
function resolve4(domain: string, server: string, timeoutMs: number): Promise<{ ips: string[]; code: string | null }> {
    return new Promise((resolve) => {
        const resolver = new dns.Resolver();
        resolver.setServers([server]);

        const timer = setTimeout(() => {
            resolver.cancel();
            resolve({ ips: [], code: "TIMEOUT" });
        }, timeoutMs);

        resolver.resolve4(domain, (err, addresses) => {
            clearTimeout(timer);
            if (err) {
                resolve({ ips: [], code: err.code || "ERROR" });
            } else {
                resolve({ ips: addresses, code: null });
            }
        });
    });
}

/**
 * Check a domain using a specific ISP DNS resolver.
 *
 * Strategy (dual-query comparison):
 * 1. Query the ISP DNS server for the domain's A records.
 * 2. Query Google DNS (8.8.8.8) as an unfiltered reference.
 * 3. BLOCKIR if:
 *    a) ISP DNS returns a known block-page IP (DNS hijacking)
 *    b) ISP DNS returns NXDOMAIN but Google DNS resolves it (DNS suppression)
 *    c) IP sets are completely different (ISP DNS redirect to different IP)
 * 4. AMAN if ISP DNS resolves to same or compatible IPs as Google.
 * 5. TIMEOUT if ISP DNS is unreachable.
 */
export async function checkDomainDNS(
    domain: string,
    dnsServer: string,
    timeoutMs: number = DEFAULT_DNS_TIMEOUT
): Promise<DnsCheckOutput> {
    const start = Date.now();

    // Run ISP DNS query and reference query in parallel
    const [ispResult, refResult] = await Promise.all([
        resolve4(domain, dnsServer, timeoutMs),
        resolve4(domain, REFERENCE_DNS, timeoutMs),
    ]);

    const latency_ms = Date.now() - start;

    // ISP DNS unreachable
    if (ispResult.code === "TIMEOUT") {
        return {
            status: "TIMEOUT",
            resolved_ips: [],
            reference_ips: refResult.ips,
            latency_ms,
            error_code: "DNS_TIMEOUT",
            dns_server: dnsServer,
            note: `DNS server ${dnsServer} tidak dapat dijangkau`,
        };
    }

    // ISP DNS connection refused
    if (ispResult.code === "ECONNREFUSED" || ispResult.code === "ECONNRESET") {
        return {
            status: "TIMEOUT",
            resolved_ips: [],
            reference_ips: refResult.ips,
            latency_ms,
            error_code: `DNS_${ispResult.code}`,
            dns_server: dnsServer,
            note: `Koneksi ke DNS server ${dnsServer} ditolak`,
        };
    }

    // Case A: ISP DNS returns known block-page IP (hijacking)
    const blockIpHit = ispResult.ips.find((ip) => KNOWN_BLOCK_IPS.has(ip));
    if (blockIpHit) {
        return {
            status: "BLOCKIR",
            resolved_ips: ispResult.ips,
            reference_ips: refResult.ips,
            latency_ms,
            error_code: "DNS_REDIRECT",
            dns_server: dnsServer,
            note: `DNS mengarahkan ke IP blokir: ${blockIpHit}`,
        };
    }

    // Case B: ISP DNS returns NXDOMAIN but Google resolves it (DNS suppression)
    const ispFailed = ispResult.ips.length === 0 && (ispResult.code === "ENOTFOUND" || ispResult.code === "ENODATA");
    const googleResolved = refResult.ips.length > 0;

    if (ispFailed && googleResolved) {
        return {
            status: "BLOCKIR",
            resolved_ips: [],
            reference_ips: refResult.ips,
            latency_ms,
            error_code: `DNS_${ispResult.code}`,
            dns_server: dnsServer,
            note: `ISP DNS tidak mengembalikan IP (${ispResult.code}) padahal domain exist di Google DNS → terblokir`,
        };
    }

    // Case C: ISP DNS resolves to completely different IPs than Google (redirect)
    // Only applies when both resolved, Google got IPs, but ISP got different ones entirely
    if (ispResult.ips.length > 0 && refResult.ips.length > 0) {
        const ispSet = new Set(ispResult.ips);
        const overlap = refResult.ips.some((ip) => ispSet.has(ip));

        if (!overlap) {
            // IPs are completely different — check if ISP IPs are in a private/suspicious range
            // or are known block page subnets (36.86.x.x = Telkom block page range)
            const suspiciousIp = ispResult.ips.find((ip) => {
                return ip.startsWith("36.86.") || ip.startsWith("180.131.") || ip.startsWith("118.98.44.");
            });

            if (suspiciousIp) {
                return {
                    status: "BLOCKIR",
                    resolved_ips: ispResult.ips,
                    reference_ips: refResult.ips,
                    latency_ms,
                    error_code: "DNS_MISMATCH_BLOCK",
                    dns_server: dnsServer,
                    note: `ISP DNS mengembalikan IP berbeda (${suspiciousIp}) — kemungkinan redirect ke halaman blokir`,
                };
            }
        }
    }

    // ISP DNS failed but Google also failed — domain mungkin tidak exist
    if (ispFailed && !googleResolved) {
        return {
            status: "AMAN",
            resolved_ips: [],
            reference_ips: [],
            latency_ms,
            error_code: null,
            dns_server: dnsServer,
            note: "Domain tidak exist di kedua DNS (bukan blokir)",
        };
    }

    // All good
    return {
        status: "AMAN",
        resolved_ips: ispResult.ips,
        reference_ips: refResult.ips,
        latency_ms,
        error_code: null,
        dns_server: dnsServer,
    };
}

/**
 * Pre-defined DNS servers for known Indonesian ISPs.
 * Note: 118.98.44.10 (IndiHome) is used for TrustPositif/Nawala checks
 * because 180.131.144.144 is not accessible from outside Indonesia.
 */
export const ISP_DNS_PRESETS: Record<string, { primary: string; secondary?: string; note: string }> = {
    INDIHOME:     { primary: "118.98.44.10",  secondary: "118.98.44.100", note: "Telkom/IndiHome — filter TrustPositif aktif" },
    TRUSTPOSITIF: { primary: "118.98.44.10",  secondary: "118.98.44.100", note: "Menggunakan IndiHome DNS (Nawala tidak accessible dari luar Indonesia)" },
    BIZNET:       { primary: "180.131.144.144",                            note: "Biznet — coba Nawala; fallback ke 118.98.44.10 jika timeout" },
    FIRSTMEDIA:   { primary: "103.12.160.2",                               note: "First Media DNS" },
    MYREPUBLIC:   { primary: "202.152.2.2",                                note: "MyRepublic DNS" },
    TELKOMSEL:    { primary: "8.8.8.8",                                    note: "Telkomsel pakai DPI bukan DNS — gunakan HTTP check" },
};
