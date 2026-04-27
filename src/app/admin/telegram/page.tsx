"use client";

import { useState, useEffect } from "react";
import { Save, Bell, Shield, Webhook, MessageSquare, RefreshCw } from "lucide-react";

type TelegramSettings = {
    bot_token_encrypted?: string;
    destinations?: string;
    webhook_url?: string;
    mode?: "blocked_only" | "full";
    send_on_change_only?: boolean;
    enabled?: boolean;
    auto_check?: boolean;
};

export default function TelegramSettingsPage() {
    const [settings, setSettings] = useState<TelegramSettings>({
        bot_token_encrypted: "",
        destinations: "[]",
        webhook_url: "",
        mode: "blocked_only",
        send_on_change_only: true,
        enabled: false,
        auto_check: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [chatIdsInput, setChatIdsInput] = useState("");

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch("/api/admin/settings");
                const data = await res.json();
                if (data && !data.error) {
                    setSettings({
                        ...data,
                        bot_token_encrypted: data.bot_token_encrypted || "", // Show it plainly as per user request to manage it
                        webhook_url: data.webhook_url || "",
                        auto_check: data.auto_check || false,
                    });

                    try {
                        const parsed = JSON.parse(data.destinations || "[]");
                        setChatIdsInput(parsed.join("\n"));
                    } catch (e) {
                        setChatIdsInput("");
                    }
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        // Parse chat IDs from multiline input
        const destinationsArray = chatIdsInput
            .split("\n")
            .map(id => id.trim())
            .filter(id => id.length > 0);

        const payload = {
            ...settings,
            destinations: destinationsArray
        };

        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (res.ok) {
                alert("Settings saved successfully!");
            } else {
                alert("Failed to save settings. Please try again.");
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            alert("An error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-neutral-400">Loading settings...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Telegram & Webhooks Settings</h2>
                <p className="text-neutral-400 text-sm mt-1">Configure your notification channels, bot credentials, and webhooks.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">

                {/* Master Switch */}
                <div className="glass-card p-6 flex items-center justify-between border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                    <div className="flex items-center">
                        <div className={`p-3 rounded-xl mr-4 ${settings.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">Enable Notifications</h3>
                            <p className="text-sm text-neutral-400">Master switch to turn all notification dispatches on or off.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.enabled}
                            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                        />
                        <div className="w-14 h-7 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                {/* Auto Check Switch */}
                <div className="glass-card p-6 flex items-center justify-between border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
                    <div className="flex items-center">
                        <div className={`p-3 rounded-xl mr-4 ${settings.auto_check ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800 text-neutral-500'}`}>
                            <RefreshCw className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-1">Auto-Run Checks (Every 5 Mins)</h3>
                            <p className="text-sm text-neutral-400">If enabled, the background worker will continuously scan all domains every 5 minutes.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.auto_check}
                            onChange={(e) => setSettings({ ...settings, auto_check: e.target.checked })}
                        />
                        <div className="w-14 h-7 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-500"></div>
                    </label>
                </div>

                {/* Main Configuration Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Bot Settings */}
                    <div className="glass-card p-6 space-y-6">
                        <div className="flex items-center mb-4">
                            <Shield className="w-5 h-5 text-blue-400 mr-2" />
                            <h3 className="text-lg font-semibold text-white">Bot Credentials</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                                Telegram Bot Token
                            </label>
                            <input
                                type="password"
                                placeholder="1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
                                value={settings.bot_token_encrypted || ""}
                                onChange={(e) => setSettings({ ...settings, bot_token_encrypted: e.target.value })}
                            />
                            <p className="text-xs text-neutral-500 mt-2">Get this from @BotFather on Telegram.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                                Chat IDs / Group IDs (One per line)
                            </label>
                            <textarea
                                placeholder="-1001234567890&#10;987654321"
                                rows={4}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
                                value={chatIdsInput}
                                onChange={(e) => setChatIdsInput(e.target.value)}
                            />
                            <p className="text-xs text-neutral-500 mt-2">The IDs of the chats or groups where the bot will send messages.</p>
                        </div>
                    </div>

                    {/* Webhook Settings */}
                    <div className="glass-card p-6 space-y-6">
                        <div className="flex items-center mb-4">
                            <Webhook className="w-5 h-5 text-purple-400 mr-2" />
                            <h3 className="text-lg font-semibold text-white">Custom Webhooks</h3>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-neutral-400 mb-2">
                                Webhook URL Endpoint
                            </label>
                            <input
                                type="url"
                                placeholder="https://api.yourdomain.com/webhook"
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm"
                                value={settings.webhook_url || ""}
                                onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
                            />
                            <p className="text-xs text-neutral-500 mt-2">If provided, NawalaBaja will POST its payload to this URL alongside Telegram messages.</p>
                        </div>

                        <hr className="border-neutral-800 my-4" />

                        <div className="flex items-center mb-4 text-neutral-300">
                            <MessageSquare className="w-5 h-5 mr-3" />
                            <span className="font-semibold text-sm">Behavior Settings</span>
                        </div>

                        <div className="space-y-4">
                            <label className="flex items-start cursor-pointer group">
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 bg-neutral-900 border-neutral-700 rounded text-emerald-500 focus:ring-emerald-500 focus:ring-offset-neutral-900"
                                        checked={settings.mode === "full"}
                                        onChange={(e) => setSettings({ ...settings, mode: e.target.checked ? "full" : "blocked_only" })}
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <span className="font-medium text-white group-hover:text-emerald-400 transition-colors">Full Report Mode</span>
                                    <p className="text-neutral-500 mt-1">If checked, it will send the status of ALL domains (AMAN, BLOCKIR, dst). By default, it only alerts BLOCKIR.</p>
                                </div>
                            </label>

                            <label className="flex items-start cursor-pointer group">
                                <div className="flex items-center h-5">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 bg-neutral-900 border-neutral-700 rounded text-emerald-500 focus:ring-emerald-500 focus:ring-offset-neutral-900"
                                        checked={settings.send_on_change_only}
                                        onChange={(e) => setSettings({ ...settings, send_on_change_only: e.target.checked })}
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <span className="font-medium text-white group-hover:text-emerald-400 transition-colors">Alert on Change Only</span>
                                    <p className="text-neutral-500 mt-1">Only sends notifications when the block status differs from the last check. Heavily recommended to prevent spam.</p>
                                </div>
                            </label>
                        </div>
                    </div>

                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-neutral-950 font-bold py-3 px-8 rounded-xl flex items-center transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]"
                    >
                        <Save className="w-5 h-5 mr-2" />
                        {saving ? "Saving Changes..." : "Save Settings"}
                    </button>
                </div>
            </form>
        </div>
    );
}
