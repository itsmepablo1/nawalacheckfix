import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";
import { checkDomainDNS } from "./dnsChecker";

export const DEFAULT_TIMEOUT = 10000; // 10s
export const BLOCK_KEYWORDS = ["internet positif", "trustpositif", "nawala", "mercusuar"];

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

        const isRedirected = final_url !== url && final_url !== `${url}/`;
        if (isRedirected) {
            const isBlockRedirect = BLOCK_KEYWORDS.some((kw) => final_url.toLowerCase().includes(kw));
            if (isBlockRedirect) {
                return { status: "BLOCKIR", http_status, final_url, latency_ms, error_code: "REDIRECT_BLOCK" };
            }
            return { status: "REDIRECT", http_status, final_url, latency_ms, error_code: null };
        }

        const text = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].toLowerCase() : "";
        const isBlockContent = BLOCK_KEYWORDS.some((kw) => title.includes(kw) || text.toLowerCase().includes(kw));
        if (isBlockContent) {
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
    timeoutMs: number = DEFAULT_TIMEOUT
): Promise<CheckOutput> {
    const result = await checkDomainDNS(domain, dnsServer, timeoutMs);

    // Map DNS result to the standard CheckOutput format
    return {
        status: result.status === "AMAN" ? "AMAN"
               : result.status === "BLOCKIR" ? "BLOCKIR"
               : "TIMEOUT",
        http_status: null, // DNS check has no HTTP status
        final_url: result.resolved_ips.length > 0 ? result.resolved_ips.join(", ") : null,
        latency_ms: result.latency_ms,
        error_code: result.error_code,
    };
}

// ── Unified check dispatcher ──────────────────────────────────────────────────
/**
 * Main entry point. Dispatches to DNS or HTTP check based on check_method.
 * @param domain      bare domain name, e.g. "youtube.com"
 * @param checkMethod "HTTP" | "DNS"
 * @param proxyUrl    HTTP/SOCKS proxy URL (used when method = HTTP)
 * @param dnsServer   DNS server IP (used when method = DNS)
 */
export async function checkDomain(
    domain: string,
    checkMethod: "HTTP" | "DNS" = "HTTP",
    proxyUrl?: string | null,
    dnsServer?: string | null,
    timeoutMs: number = DEFAULT_TIMEOUT
): Promise<CheckOutput> {
    if (checkMethod === "DNS") {
        if (!dnsServer) {
            // Fallback: no DNS server configured → can't do DNS check
            return {
                status: "TIMEOUT",
                http_status: null,
                final_url: null,
                latency_ms: 0,
                error_code: "NO_DNS_SERVER_CONFIGURED",
            };
        }
        return checkDomainDNSMethod(domain, dnsServer, timeoutMs);
    }

    // Default: HTTP check
    return checkDomainHTTP(domain, proxyUrl ?? undefined, timeoutMs);
}
