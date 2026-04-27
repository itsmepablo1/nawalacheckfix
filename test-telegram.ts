import { sendTelegramMessage, getTelegramBot } from "./src/lib/telegram";
import { getPrisma } from "./src/lib/prisma";

async function test() {
    console.log("Testing Telegram integration...");

    const prisma = getPrisma();
    const settings = await prisma.telegramSettings.findFirst();
    if (!settings) {
        console.log("No settings found in DB!");
        process.exit(1);
    }
    console.log("Settings found. Destinations:", settings.destinations);

    const bot = await getTelegramBot();
    if (!bot) {
        console.log("Bot failed to initialize.");
        process.exit(1);
    }

    try {
        const dests = JSON.parse(settings.destinations || "[]");
        for (const dest of dests) {
            console.log(`Sending to ${dest}...`);
            await bot.sendMessage(dest, "<b>Test Message</b>\nHello from Nawala Checker System!", { parse_mode: "HTML" });
            console.log("Sent successfully to", dest);
        }
    } catch (e) {
        console.error("Failed:", e);
    }
    process.exit(0);
}

test();
