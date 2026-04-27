import TelegramBot from "node-telegram-bot-api";
import { getPrisma } from "./prisma";

let botInstance: TelegramBot | null = null;
let botToken: string | null = null;

/**
 * Get (or create) a TelegramBot instance using token from DB.
 * Resets the instance if the token has changed.
 */
export async function getTelegramBot(): Promise<TelegramBot | null> {
    const prisma = getPrisma();
    const settings = await prisma.telegramSettings.findFirst();

    if (!settings || !settings.enabled || !settings.bot_token_encrypted) {
        botInstance = null;
        botToken = null;
        return null;
    }

    const token = settings.bot_token_encrypted;

    // Re-create instance if token changed or not yet created
    if (!botInstance || botToken !== token) {
        botInstance = new TelegramBot(token, { polling: false });
        botToken = token;
    }

    return botInstance;
}

/**
 * Send a Telegram message to a specific chat ID.
 * Uses HTML parse mode for formatting.
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
    try {
        const bot = await getTelegramBot();
        if (!bot) {
            console.warn("[Telegram] Bot not configured or disabled.");
            return false;
        }
        await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
        return true;
    } catch (err: any) {
        console.error(`[Telegram] Failed to send to ${chatId}:`, err.message);
        return false;
    }
}
