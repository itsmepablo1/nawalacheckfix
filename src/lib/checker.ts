import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";
import { checkDomainDNS } from "./dnsChecker";

export const DEFAULT_TIMEOUT = 10000; // 10s

/**
 * Keywords searched in the redirect URL and/or page content to detect block pages.
 * Order matters: more specific first to reduce false positives.
 */
export const BLOCK_KEYWORDS = [
    // Known Indonesian block infrastructure
    "internet positif", "trustpositif", "nawala", "mercusuar",
    // Generic Indonesian block page copy
    "diblokir", "terblokir", "akses diblokir", "akses dibatasi",
    "situs ini diblokir", "halaman ini diblokir", "konten ini diblokir",
    "internet sehat", "kominfo", "kemenkominfo",
    // English equivalents used by some ISPs
    "this site is blocked", "access denied", "access blocked",
    // ISP block page URL slugs
    "blockpage", "block-page", "blocked",
];

/** Regex to detect redirect to a bare IPv4 address — almost always an ISP block page */
const IP_REDIRECT_RE = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}([:/?]|$)/;

export type CheckOutput = {
    status: "AMAN" | "BLOCKIR" | "REDIRECT" | "TIMEOUT";
    http_status: number | null;
    final_url: string | null;
    latency_ms: number;
    error_code: string | null;
};

// ── HTTP-based check (original) ───────────────────────────────────────────────
export async function checkDomainHTTP(
    domain: string,
    proxyUrl?: string,
    timeoutMs: number = DEFAULT_TIMEOUT
): Promise<CheckOutput> {
    const url = `http://${domain}`;
    const start = Date.now();

    try {
        const options: any = {
            method: "GET",
            timeout: timeoutMs,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            maxRedirects: 5,
            validateStatus: () => true,
        };

        if (proxyUrl) {
            options.httpsAgent = new HttpsProxyAgent(proxyUrl);
            options.proxy = false;
        }

        const response = await axios.get(url, options);
        const latency_ms = Date.now() - start;
        const final_url = response.request?.res?.responseUrl || url;
        const http_status = response.status;

        if (http_status === 451) {
            return { status: "BLOCKIR", http_status, final_url, latency_ms, error_code: "451_UNAVAILABLE" };
        }

        // ── Parse response body (used for both redirect and direct checks) ────
        const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].toLowerCase() : "";

        const isRedirected = final_url !== url && final_url !== `${url}/`;
        if (isRedirected) {
            // 1. Redirect to bare IP = ISP block page (Smartfren, Indosat, XL, etc.)
            if (IP_REDIRECT_RE.test(final_url)) {
                return { status: "BLOCKIR", http_status, final_url, latency_ms, error_code: "IP_REDIRECT_BLOCK" };
            }

            // 2. Block keyword in the redirect URL itself
            if (BLOCK_KEYWORDS.some((kw) => final_url.toLowerCase().includes(kw))) {
                return { status: "BLOCKIR", http_status, final_url, latency_ms, error_code: "REDIRECT_BLOCK" };
            }

            // 3. Block keyword in the content of the redirect destination
            if (BLOCK_KEYWORDS.some((kw) => title.includes(kw) || text.toLowerCase().includes(kw))) {
                return { status: "BLOCKIR", http_status, final_url, latency_ms, error_code: "REDIRECT_BLOCK_CONTENT" };
            }

            return { status: "REDIRECT", http_status, final_url, latency_ms, error_code: null };
        }

        // ── No redirect: inspect response body ───────────────────────────────
        if (BLOCK_KEYWORDS.some((kw) => title.includes(kw) || text.toLowerCase().includes(kw))) {
            return { status: "BLOCKIR", http_status, final_url, latency_ms, error_code: "CONTENT_BLOCK" };
        }

        return { status: "AMAN", http_status, final_url, latency_ms, error_code: null };
    } catch (err: any) {
        const latency_ms = Date.now() - start;
        if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
            return { status: "TIMEOUT", http_status: null, final_url: null, latency_ms, error_code: "TIMEOUT" };
        }
        return { status: "TIMEOUT", http_status: null, final_url: null, latency_ms, error_code: err.code || "CONN_ERROR" };
    }
}

// ── DNS-based check ───────────────────────────────────────────────────────────
export async function checkDomainDNSMethod(
    domain: string,
    dnsServer: string,
    timeoutMs: number = DEFAULT_TIMEOUT,
    dnsServerSecondary?: string | null,
): Promise<CheckOutput> {
    const result = await checkDomainDNS(domain, dnsServer, timeoutMs);

    // If primary DNS timed out and a secondary is configured, try fallback
    if (result.status === "TIMEOUT" && dnsServerSecondary) {
        const fallback = await checkDomainDNS(domain, dnsServerSecondary, timeoutMs);
        return {
            status: fallback.status === "AMAN" ? "AMAN"
                   : fallback.status === "BLOCKIR" ? "BLOCKIR"
                   : "TIMEOUT",
            http_status: null,
            final_url: fallback.resolved_ips.length > 0 ? fallback.resolved_ips.join(", ") : null,
            latency_ms: fallback.latency_ms,
            error_code: fallback.error_code
                ? `PRIMARY_TIMEOUT:FALLBACK_${fallback.error_code}`
                : "PRIMARY_TIMEOUT:FALLBACK_OK",
        };
    }

    // Map DNS result to the standard CheckOutput format
    return {
        status: result.status === "AMAN" ? "AMAN"
               : result.status === "BLOCKIR" ? "BLOCKIR"
               : "TIMEOUT",
        http_status: null,
        final_url: result.resolved_ips.length > 0 ? result.resolved_ips.join(", ") : null,
        latency_ms: result.latency_ms,
        error_code: result.error_code,
    };
}

// ── indiwtf.com API check ────────────────────────────────────────────────────
/**
 * Check a domain via indiwtf.com API.
 * indiwtf has real infrastructure inside Indonesian ISP networks,
 * making it the most accurate method for mobile ISPs (Telkomsel, XL, Indosat, Smartfren, AXIS).
 *
 * API docs: https://indiwtf.com/api
 * Response: { domain, status: "blocked"|"allowed", ip }
 */
export async function checkDomainIndiwtf(
    domain: string,
    apiToken: string,
    timeoutMs: number = DEFAULT_TIMEOUT,
): Promise<CheckOutput> {
    const start = Date.now();
    try {
        const res = await axios.get<{ domain: string; status: string; ip?: string; error?: string }>(
            "https://indiwtf.com/api/check",
            {
                params: { domain, token: apiToken },
                timeout: timeoutMs,
                headers: {
                    "User-Agent": "NawalaChecker/1.0",
                    "Accept": "application/json",
                },
            }
        );
        const latency_ms = Date.now() - start;
        const data = res.data;

        if (data.error) {
            return {
                status: "TIMEOUT",
                http_status: null,
                final_url: null,
                latency_ms,
                error_code: `INDIWTF_ERROR:${data.error}`,
            };
        }

        if (data.status === "blocked") {
            return {
                status: "BLOCKIR",
                http_status: null,
                final_url: data.ip ?? null,
                latency_ms,
                error_code: "INDIWTF_BLOCKED",
            };
        }

        // status === "allowed"
        return {
            status: "AMAN",
            http_status: null,
            final_url: data.ip ?? null,
            latency_ms,
            error_code: null,
        };
    } catch (err: any) {
        const latency_ms = Date.now() - start;
        if (err.response?.status === 401 || err.response?.data?.error?.includes("token")) {
            return { status: "TIMEOUT", http_status: null, final_url: null, latency_ms, error_code: "INDIWTF_INVALID_TOKEN" };
        }
        if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
            return { status: "TIMEOUT", http_status: null, final_url: null, latency_ms, error_code: "INDIWTF_TIMEOUT" };
        }
        return { status: "TIMEOUT", http_status: null, final_url: null, latency_ms, error_code: `INDIWTF_${err.code || "ERROR"}` };
    }
}

// ── Unified check dispatcher ──────────────────────────────────────────────────
/**
 * Main entry point. Dispatches to the appropriate checker based on check_method.
 * @param domain             Bare domain name, e.g. "youtube.com"
 * @param checkMethod        "HTTP" | "DNS" | "APN" | "MMSC" | "INDIWTF"
 * @param proxyUrl           HTTP/SOCKS proxy URL (HTTP method)
 * @param dnsServer          Primary DNS server IP (DNS method)
 * @param timeoutMs          Request timeout in milliseconds
 * @param apnHost            APN hostname (stored; requires SIM hardware)
 * @param mmscUrl            MMSC gateway URL (stored; requires SIM hardware)
 * @param dnsServerSecondary Secondary DNS fallback if primary times out
 * @param indiwtfToken       indiwtf.com API token (INDIWTF method)
 */
export async function checkDomain(
    domain: string,
    checkMethod: "HTTP" | "DNS" | "APN" | "MMSC" | "INDIWTF" = "HTTP",
    proxyUrl?: string | null,
    dnsServer?: string | null,
    timeoutMs: number = DEFAULT_TIMEOUT,
    apnHost?: string | null,
    mmscUrl?: string | null,
    dnsServerSecondary?: string | null,
    indiwtfToken?: string | null,
): Promise<CheckOutput> {
    // ── indiwtf.com API (most accurate for Indonesian mobile ISPs) ───────────
    if (checkMethod === "INDIWTF") {
        const token = indiwtfToken || process.env.INDIWTF_API_TOKEN;
        if (!token) {
            return {
                status: "TIMEOUT",
                http_status: null,
                final_url: null,
                latency_ms: 0,
                error_code: "NO_INDIWTF_TOKEN",
            };
        }
        return checkDomainIndiwtf(domain, token, timeoutMs);
    }

    // ── DNS check ─────────────────────────────────────────────────────
    if (checkMethod === "DNS") {
        if (!dnsServer) {
            return {
                status: "TIMEOUT",
                http_status: null,
                final_url: null,
                latency_ms: 0,
                error_code: "NO_DNS_SERVER_CONFIGURED",
            };
        }
        return checkDomainDNSMethod(domain, dnsServer, timeoutMs, dnsServerSecondary ?? undefined);
    }

    // ── APN / MMSC (requires SIM hardware — fallback to HTTP for now) ───────
    if (checkMethod === "APN" || checkMethod === "MMSC") {
        return checkDomainHTTP(domain, proxyUrl ?? undefined, timeoutMs);
    }

    // ── Default: HTTP check ────────────────────────────────────────────
    return checkDomainHTTP(domain, proxyUrl ?? undefined, timeoutMs);
}
