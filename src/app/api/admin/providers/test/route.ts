import { NextRequest, NextResponse } from "next/server";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session || session.role !== "MASTER" && session.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    try {
        const { proxy_url } = await req.json();

        if (!proxy_url) {
            return NextResponse.json({ error: "Proxy URL is required" }, { status: 400 });
        }

        let formattedUrl = proxy_url.trim();
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://") && !formattedUrl.startsWith("socks5://")) {
            formattedUrl = "http://" + formattedUrl;
        }

        const start = Date.now();
        const response = await axios.get("http://ip-api.com/json", {
            timeout: 10000,
            httpsAgent: new HttpsProxyAgent(formattedUrl),
            proxy: false, // Ensure we use the agent and not axios default
        });

        const latency = Date.now() - start;

        return NextResponse.json({
            success: true,
            latency,
            data: response.data
        });

    } catch (error: any) {
        console.error("Proxy Test Failed:", error.message);
        return NextResponse.json({
            error: error.message || "Failed to connect to proxy",
            code: error.code || "UNKNOWN"
        }, { status: 500 });
    }
}
