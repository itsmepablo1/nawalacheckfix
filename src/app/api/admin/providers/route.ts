import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Helper: cek apakah user sudah login (semua role boleh akses)
async function requireAuth(req: NextRequest) {
    const session = await getSession(req);
    if (!session) return null;
    return session;
}

// ── GET: list all providers with heartbeat ──────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const prisma = getPrisma();
        const providers = await prisma.provider.findMany({
            orderBy: { name: "asc" },
            include: { heartbeat: true }
        });
        return NextResponse.json({ providers });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// ── PUT: create a new provider ──────────────────────────────────────────────
export async function PUT(req: NextRequest) {
    try {
        const session = await requireAuth(req);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized - silakan login" }, { status: 401 });
        }

        const body = await req.json();
        const { key, name, is_active, proxy_url, dns_server, dns_server_secondary, check_method, apn_host, mmsc_url } = body;

        if (!key || !name) {
            return NextResponse.json({ error: "Key dan Name wajib diisi" }, { status: 400 });
        }

        const cleanKey = key.trim().toUpperCase().replace(/\s+/g, "_");

        let formattedUrl = proxy_url ? proxy_url.trim() : null;
        if (
            formattedUrl &&
            !formattedUrl.startsWith("http://") &&
            !formattedUrl.startsWith("https://") &&
            !formattedUrl.startsWith("socks5://")
        ) {
            formattedUrl = "http://" + formattedUrl;
        }

        const validMethods = ["HTTP", "DNS", "APN", "MMSC", "INDIWTF"];
        const resolvedMethod = validMethods.includes(check_method) ? check_method : "HTTP";

        const prisma = getPrisma();

        const existing = await prisma.provider.findUnique({ where: { key: cleanKey } });
        if (existing) {
            return NextResponse.json({ error: `Provider dengan key "${cleanKey}" sudah ada` }, { status: 409 });
        }

        const provider = await prisma.provider.create({
            data: {
                key: cleanKey,
                name: name.trim(),
                is_active: is_active !== undefined ? Boolean(is_active) : true,
                proxy_url: formattedUrl ?? null,
                dns_server: dns_server ? dns_server.trim() : null,
                check_method: resolvedMethod,
                apn_host: apn_host ? apn_host.trim() : null,
                mmsc_url: mmsc_url ? mmsc_url.trim() : null,
                dns_server_secondary: dns_server_secondary ? dns_server_secondary.trim() : null,
            }
        });

        return NextResponse.json({ success: true, provider });
    } catch (error: any) {
        console.error("Provider create error:", error);
        return NextResponse.json({
            error: error?.message || "Internal Server Error",
            code: error?.code,
            meta: error?.meta,
        }, { status: 500 });
    }
}

// ── POST: update proxy_url / is_active / dns_server / check_method ───────────
export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth(req);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized - silakan login" }, { status: 401 });
        }

        const body = await req.json();
        const { key, proxy_url, is_active, dns_server, dns_server_secondary, check_method, apn_host, mmsc_url } = body;

        if (!key) {
            return NextResponse.json({ error: "Missing provider key" }, { status: 400 });
        }

        let formattedUrl = proxy_url !== undefined ? (proxy_url ? proxy_url.trim() : null) : undefined;
        if (
            formattedUrl &&
            !formattedUrl.startsWith("http://") &&
            !formattedUrl.startsWith("https://") &&
            !formattedUrl.startsWith("socks5://")
        ) {
            formattedUrl = "http://" + formattedUrl;
        }

        const validMethods = ["HTTP", "DNS", "APN", "MMSC"];
        const prisma = getPrisma();
        const data: any = {};
        if (formattedUrl !== undefined) data.proxy_url = formattedUrl;
        if (is_active !== undefined) data.is_active = Boolean(is_active);
        if (dns_server !== undefined) data.dns_server = dns_server ? dns_server.trim() : null;
        if (check_method !== undefined) data.check_method = validMethods.includes(check_method) ? check_method : "HTTP";
        if (apn_host !== undefined) data.apn_host = apn_host ? apn_host.trim() : null;
        if (mmsc_url !== undefined) data.mmsc_url = mmsc_url ? mmsc_url.trim() : null;
        if (dns_server_secondary !== undefined) data.dns_server_secondary = dns_server_secondary ? dns_server_secondary.trim() : null;

        await prisma.provider.update({ where: { key }, data });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Provider update error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// ── DELETE: remove a provider by key ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const session = await requireAuth(req);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized - silakan login" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const key = searchParams.get("key");

        if (!key) {
            return NextResponse.json({ error: "Missing provider key" }, { status: 400 });
        }

        const prisma = getPrisma();
        await prisma.provider.delete({ where: { key } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Provider delete error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
