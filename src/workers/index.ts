import "./checkerWorker";
import "./telegramWorker";
import { checkerQueue } from "../lib/queue";
import { getPrisma } from "../lib/prisma";

const DEFAULT_INTERVAL = 5; // menit

async function startAutoCheck() {
    const prisma = getPrisma();

    // Baca interval dari DB, fallback ke 5 menit
    let intervalMinutes = DEFAULT_INTERVAL;
    try {
        const settings = await prisma.telegramSettings.findFirst();
        if (settings?.check_interval_minutes && settings.check_interval_minutes > 0) {
            intervalMinutes = settings.check_interval_minutes;
        }
    } catch {
        console.warn("[Workers] Gagal baca interval dari DB, pakai default 5 menit.");
    }

    const cronPattern = `*/${intervalMinutes} * * * *`;
    console.log(`🚀 Background Workers started. Auto-check setiap ${intervalMinutes} menit (${cronPattern})`);

    // Hapus job lama dulu (kalau ada) lalu tambah dengan interval terbaru
    try {
        await checkerQueue.removeRepeatableByKey(`dispatch-all:::${cronPattern}`);
    } catch { /* ignore jika belum ada */ }

    await checkerQueue.add(
        "dispatch-all",
        { isManual: false },
        {
            repeat: { pattern: cronPattern },
            jobId: "auto-dispatch-all",
            removeOnComplete: true,
            removeOnFail: true,
        }
    ).catch(err => console.error("Failed to add repeatable job:", err));
}

startAutoCheck();
