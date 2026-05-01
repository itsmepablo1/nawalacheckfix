import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { runAllChecks } from "@/workers/checkerWorker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LOCK_KEY = "nawala:check:running";

export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cek apakah ada run yang sedang berjalan
    const holder = await redis.get(LOCK_KEY);
    if (holder) {
        return NextResponse.json(
            { success: false, message: `⚠️ Check sedang berjalan (oleh: ${holder}), tunggu sebentar.` },
            { status: 429 }
        );
    }

    try {
        const prisma = getPrisma();
        const [domains, providers] = await Promise.all([
            prisma.domain.findMany({ where: { is_active: true }, select: { id: true } }),
            prisma.provider.findMany({ where: { is_active: true }, select: { id: true } }),
        ]);

        if (domains.length === 0) {
            return NextResponse.json({ success: false, message: "Tidak ada domain aktif." });
        }
        if (providers.length === 0) {
            return NextResponse.json({ success: false, message: "Tidak ada provider aktif." });
        }

        // Jalankan semua checks (lock dikelola di dalam runAllChecks)
        const result = await runAllChecks("manual");

        return NextResponse.json({
            success: true,
            message: `✅ Selesai! ${result}`,
            stats: { domains: domains.length, providers: providers.length },
        });

    } catch (error: any) {
        console.error("Trigger checks failed:", error);
        // Pastikan lock dilepas jika crash di luar runAllChecks
        await redis.del(LOCK_KEY).catch(() => {});
        return NextResponse.json({ error: "Gagal menjalankan cek.", details: error.message }, { status: 500 });
    }
}
