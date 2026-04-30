"use client";

import { useState, useEffect } from "react";
import {
    Network, ServerCog, Save, ActivitySquare, CheckCircle, XCircle,
    Wifi, WifiOff, ShieldCheck, Plus, X, Trash2, ToggleLeft, ToggleRight, Check
} from "lucide-react";

// ── Per-provider cosmetic config ─────────────────────────────────────────────
const PROVIDER_META: Record<string, { emoji: string }> = {
    TRUSTPOSITIF: { emoji: "🏛️" },
    TELKOMSEL:    { emoji: "📡" },
    INDIHOME:     { emoji: "🏠" },
    FIRSTMEDIA:   { emoji: "🎬" },
    MYREPUBLIC:   { emoji: "🌐" },
    BIZNET:       { emoji: "⚡" },
};
const DEFAULT_META = { emoji: "🌐" };

// ── Provider Status Card ──────────────────────────────────────────────────────
function ProviderStatusCard({
    provider,
    onToggleActive,
    onDelete,
}: {
    provider: any;
    onToggleActive: (key: string, current: boolean) => void;
    onDelete: (key: string, name: string) => void;
}) {
    const meta = PROVIDER_META[provider.key] ?? DEFAULT_META;
    const isActive = provider.is_active;
    const isRunning = provider.heartbeat?.status === "RUNNING";
    const [pendingDelete, setPendingDelete] = useState(false);

    return (
        <div className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-300 group
            ${isActive
                ? "bg-neutral-900 border-neutral-700 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                : "bg-neutral-900/50 border-neutral-800/60 opacity-60 hover:opacity-80"
            }`}
        >
            {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none rounded-2xl" />
            )}

            {/* Action buttons (always visible, no hover trick) */}
            <div className="absolute top-2 right-2 flex gap-1">
                {pendingDelete ? (
                    // Inline confirm
                    <div className="flex items-center gap-1 bg-neutral-900 border border-rose-500/30 rounded-lg px-2 py-1 shadow-lg">
                        <span className="text-[10px] text-rose-400 font-medium mr-1">Hapus?</span>
                        <button
                            onClick={() => { onDelete(provider.key, provider.name); setPendingDelete(false); }}
                            className="p-1 rounded bg-rose-500 hover:bg-rose-400 text-white transition-all"
                            title="Ya, hapus"
                        >
                            <Check className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setPendingDelete(false)}
                            className="p-1 rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300 transition-all"
                            title="Batal"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            title={isActive ? "Nonaktifkan" : "Aktifkan"}
                            onClick={() => onToggleActive(provider.key, isActive)}
                            className={`p-1.5 rounded-lg border text-[10px] transition-all
                                ${isActive
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                    : "bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700"
                                }`}
                        >
                            {isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            title="Hapus provider"
                            onClick={() => setPendingDelete(true)}
                            className="p-1.5 rounded-lg border bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Icon + name */}
            <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border
                    ${isActive ? "bg-neutral-800 border-neutral-700" : "bg-neutral-800/60 border-neutral-800"}`}
                >
                    {meta.emoji}
                </div>
                <div className="flex-1 min-w-0 pr-8">
                    <div className="text-sm font-bold text-white truncate">{provider.name}</div>
                    <div className="text-[10px] text-neutral-500 font-mono tracking-widest mt-0.5">{provider.key}</div>
                </div>
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
                {isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        ACTIVE
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        NOT ACTIVE
                    </span>
                )}

                {isActive && provider.heartbeat && (
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border
                        ${isRunning
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-neutral-800 text-neutral-500 border-neutral-700"
                        }`}
                    >
                        {isRunning
                            ? <><Wifi className="w-3 h-3" /> RUNNING</>
                            : <><WifiOff className="w-3 h-3" /> DOWN</>
                        }
                    </span>
                )}
            </div>

            {/* Method + config indicator */}
            <div className={`text-[11px] font-mono flex items-center gap-1.5 ${
                provider.check_method === "DNS"  ? (provider.dns_server  ? "text-blue-400/80"   : "text-neutral-600") :
                provider.check_method === "APN"  ? (provider.apn_host   ? "text-violet-400/80" : "text-neutral-600") :
                provider.check_method === "MMSC" ? (provider.mmsc_url   ? "text-amber-400/80"  : "text-neutral-600") :
                                                   (provider.proxy_url   ? "text-amber-400/80"  : "text-neutral-600")
            }`}>
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span className="truncate">
                    {provider.check_method === "DNS"  && (provider.dns_server ? `DNS: ${provider.dns_server}` : "DNS: (belum diset)")}
                    {provider.check_method === "APN"  && (provider.apn_host   ? `APN: ${provider.apn_host}`   : "APN: (belum diset)")}
                    {provider.check_method === "MMSC" && (provider.mmsc_url   ? `MMSC: ${provider.mmsc_url}`  : "MMSC: (belum diset)")}
                    {provider.check_method === "HTTP" && (provider.proxy_url  ? provider.proxy_url             : "Direct / No Proxy")}
                </span>
            </div>
        </div>
    );
}

// ── Add Provider Modal ────────────────────────────────────────────────────────

// ISP DNS presets for quick-fill
const DNS_PRESETS: Record<string, string> = {
    TRUSTPOSITIF: "180.131.144.144",
    INDIHOME:     "118.98.44.10",
    BIZNET:       "180.131.144.144",
    FIRSTMEDIA:   "103.12.160.2",
    MYREPUBLIC:   "202.152.2.2",
    TELKOMSEL:    "8.8.8.8",
    // Operator seluler — DNS mereka bisa digunakan untuk deteksi blokir dari server eksternal
    SMARTFREN:    "202.67.41.4",
    INDOSAT:      "202.152.0.1",
    XL:           "202.152.0.2",
    AXIS:         "202.152.0.2",
    TRI:          "8.8.8.8", // Tri tidak punya DNS publik — gunakan INDIWTF untuk akurasi
};

// ISP APN presets for quick-fill
const APN_PRESETS: Record<string, string> = {
    TELKOMSEL: "internet",
    INDOSAT:   "indosatgprs",
    XL:        "www.xlgprs.net",
    AXIS:      "axis",
    SMARTFREN: "internet",
    TRI:       "3gprs",
};

// ISP MMSC presets for quick-fill
const MMSC_PRESETS: Record<string, string> = {
    TELKOMSEL: "http://mms.telkomsel.com",
    INDOSAT:   "http://mmsc.indosat.com",
    XL:        "http://mmc.xl.net.id/servlets/mms",
    SMARTFREN: "http://10.1.1.1/onlinesmsgw",
    TRI:       "http://mms.tri.co.id",
};

function AddProviderModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [form, setForm] = useState({
        key: "", name: "", proxy_url: "", dns_server: "", dns_server_secondary: "", apn_host: "", mmsc_url: "",
        check_method: "HTTP" as "HTTP" | "DNS" | "APN" | "MMSC" | "INDIWTF",
        is_active: true
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.key || !form.name) { setError("Key dan Name wajib diisi."); return; }
        setSaving(true);
        setError("");
        try {
            const res = await fetch("/api/admin/providers", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || "Gagal menambah provider."); }
            else { onSuccess(); onClose(); }
        } catch { setError("Network error"); }
        setSaving(false);
    };

    const SUGGESTIONS = ["TRUSTPOSITIF", "TELKOMSEL", "INDIHOME", "FIRSTMEDIA", "MYREPUBLIC", "BIZNET", "INDOSAT", "SMARTFREN", "XL", "AXIS"];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-base font-bold text-white">Tambah Provider Baru</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    {/* Key */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Provider Key *</label>
                        <input
                            value={form.key}
                            onChange={e => setForm(p => ({ ...p, key: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
                            placeholder="Contoh: TELKOMSEL"
                            className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                        />
                        {/* Quick-pick suggestions */}
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {SUGGESTIONS.map(s => (
                                <button
                                    key={s} type="button"
                                    onClick={() => setForm(p => ({
                                        ...p,
                                        key: s,
                                        name: p.name || s.charAt(0) + s.slice(1).toLowerCase(),
                                        // Auto-fill config presets based on ISP
                                        dns_server: p.dns_server || DNS_PRESETS[s] || "",
                                        apn_host: p.apn_host || APN_PRESETS[s] || "",
                                        mmsc_url: p.mmsc_url || MMSC_PRESETS[s] || "",
                                        check_method: DNS_PRESETS[s] ? "DNS" : APN_PRESETS[s] ? "APN" : p.check_method,
                                    }))}
                                    className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors font-mono"
                                >{s}</button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Display Name *</label>
                        <input
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Contoh: Telkomsel"
                            className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                    </div>

                    {/* Check Method Selector */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Metode Pengecekan</label>
                        <div className="grid grid-cols-2 gap-2">
                            {([
                                { value: "HTTP",     label: "🌐 HTTP / Proxy",     color: "emerald" },
                                { value: "DNS",      label: "🔍 DNS Query",         color: "blue"    },
                                { value: "APN",      label: "📶 APN Mobile",        color: "violet"  },
                                { value: "MMSC",     label: "📨 MMSC Gateway",      color: "amber"   },
                                { value: "INDIWTF",  label: "🛡️ indiwtf API",      color: "cyan"    },
                            ] as const).map(m => (
                                <button
                                    key={m.value} type="button"
                                    onClick={() => setForm(p => ({ ...p, check_method: m.value }))}
                                    className={`py-2 rounded-xl border text-sm font-semibold transition-all ${
                                        form.check_method === m.value
                                            ? m.color === "emerald" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                                            : m.color === "blue"    ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                                            : m.color === "violet"  ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                                            : m.color === "amber"   ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                                                     : "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
                                            : "bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700"
                                    }`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-neutral-600">
                            {form.check_method === "DNS"     && "Menggunakan DNS server ISP untuk mendeteksi blokir di level DNS."}
                            {form.check_method === "HTTP"    && "Menggunakan HTTP request melalui proxy untuk mendeteksi blokir."}
                            {form.check_method === "APN"     && "Menggunakan APN jaringan seluler ISP untuk mendeteksi blokir mobile."}
                            {form.check_method === "MMSC"    && "Menggunakan gateway MMSC operator untuk pengecekan koneksi MMS."}
                            {form.check_method === "INDIWTF" && "✅ Paling akurat untuk ISP seluler — indiwtf.com punya server di dalam jaringan Telkomsel, XL, Indosat, Smartfren."}
                        </p>
                    </div>

                    {/* indiwtf API info — no extra config needed */}
                    {form.check_method === "INDIWTF" && (
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-1">
                            <p className="text-xs font-semibold text-cyan-400">🛡️ indiwtf.com API — Tidak perlu konfigurasi tambahan</p>
                            <p className="text-[11px] text-neutral-400">Token API sudah dikonfigurasi di server. Metode ini menggunakan infrastruktur real di dalam jaringan ISP Indonesia untuk akurasi ~99%.</p>
                            <p className="text-[10px] text-neutral-600">Coverage: Telkomsel · IndiHome · XL · IM3 · Tri · Smartfren</p>
                        </div>
                    )}

                    {/* Conditional fields based on method */}
                    {form.check_method === "HTTP" && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Proxy URL (opsional)</label>
                            <input
                                value={form.proxy_url}
                                onChange={e => setForm(p => ({ ...p, proxy_url: e.target.value }))}
                                placeholder="http://user:pass@127.0.0.1:8080"
                                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                            />
                        </div>
                    )}

                    {form.check_method === "DNS" && (
                        <div className="space-y-3">
                            {/* Primary DNS */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">DNS Server (Primer) *</label>
                                <input
                                    value={form.dns_server}
                                    onChange={e => setForm(p => ({ ...p, dns_server: e.target.value }))}
                                    placeholder="Contoh: 118.98.44.10"
                                    className="w-full bg-neutral-950 border border-blue-500/30 text-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                                />
                                {/* DNS Presets quick pick */}
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(DNS_PRESETS).map(([isp, ip]) => (
                                        <button key={isp} type="button"
                                            onClick={() => setForm(p => ({ ...p, dns_server: ip }))}
                                            className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:border-blue-500/40 hover:text-blue-400 transition-colors font-mono"
                                        >{isp}: {ip}</button>
                                    ))}
                                </div>
                            </div>
                            {/* Secondary DNS fallback */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                                    DNS Server (Fallback)
                                    <span className="text-[9px] font-normal text-neutral-600 normal-case tracking-normal">— dicoba jika primer timeout</span>
                                </label>
                                <input
                                    value={form.dns_server_secondary}
                                    onChange={e => setForm(p => ({ ...p, dns_server_secondary: e.target.value }))}
                                    placeholder="Contoh: 202.67.41.5 (opsional)"
                                    className="w-full bg-neutral-950 border border-blue-500/20 text-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-mono opacity-80"
                                />
                            </div>
                        </div>
                    )}

                    {form.check_method === "APN" && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">APN Host *</label>
                            <input
                                value={form.apn_host}
                                onChange={e => setForm(p => ({ ...p, apn_host: e.target.value }))}
                                placeholder="Contoh: internet atau gprs.telkomsel.com"
                                className="w-full bg-neutral-950 border border-violet-500/30 text-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 font-mono"
                            />
                            {/* APN Presets quick pick */}
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(APN_PRESETS).map(([isp, apn]) => (
                                    <button key={isp} type="button"
                                        onClick={() => setForm(p => ({ ...p, apn_host: apn }))}
                                        className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:border-violet-500/40 hover:text-violet-400 transition-colors font-mono"
                                    >{isp}: {apn}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {form.check_method === "MMSC" && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">MMSC URL *</label>
                            <input
                                value={form.mmsc_url}
                                onChange={e => setForm(p => ({ ...p, mmsc_url: e.target.value }))}
                                placeholder="Contoh: http://mms.telkomsel.com"
                                className="w-full bg-neutral-950 border border-amber-500/30 text-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 font-mono"
                            />
                            {/* MMSC Presets quick pick */}
                            <div className="flex flex-wrap gap-1.5">
                                {Object.entries(MMSC_PRESETS).map(([isp, url]) => (
                                    <button key={isp} type="button"
                                        onClick={() => setForm(p => ({ ...p, mmsc_url: url }))}
                                        className="text-[10px] px-2 py-0.5 rounded border border-neutral-700 text-neutral-400 hover:border-amber-500/40 hover:text-amber-400 transition-colors font-mono"
                                    >{isp}</button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* is_active toggle */}
                    <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-neutral-950 border border-neutral-800">
                        <div>
                            <div className="text-sm font-medium text-neutral-200">Status Provider</div>
                            <div className="text-xs text-neutral-500">Aktifkan provider setelah dibuat</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                            className={`relative w-11 h-6 rounded-full border transition-all duration-300 focus:outline-none
                                ${form.is_active ? "bg-emerald-500 border-emerald-400" : "bg-neutral-700 border-neutral-600"}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300
                                ${form.is_active ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                            <XCircle className="w-4 h-4 shrink-0" /> {error}
                        </div>
                    )}

                    <div className="flex gap-2 pt-1">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-neutral-700 text-neutral-400 hover:bg-neutral-800 text-sm font-semibold transition-all">
                            Batal
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                            <Plus className="w-4 h-4" />
                            {saving ? "Menyimpan..." : "Tambah Provider"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProvidersPage() {
    const [providers, setProviders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingConfig, setSavingConfig] = useState<string | null>(null);
    const [testingConfig, setTestingConfig] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, any>>({});
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchProviders = async () => {
        try {
            const res = await fetch("/api/admin/providers");
            const data = await res.json();
            if (data.providers) setProviders(data.providers);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProviders();
        const interval = setInterval(fetchProviders, 15000);
        return () => clearInterval(interval);
    }, []);

    // Toggle is_active
    const handleToggleActive = async (key: string, current: boolean) => {
        const res = await fetch("/api/admin/providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, is_active: !current }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal mengubah status provider.");
        }
        fetchProviders();
    };

    // Delete provider — called after inline confirmation in the card
    const handleDelete = async (key: string, name: string) => {
        const res = await fetch(`/api/admin/providers?key=${encodeURIComponent(key)}`, { method: "DELETE" });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menghapus provider.");
        }
        fetchProviders();
    };

    // Save proxy config (only sends proxy_url, does not touch other fields)
    const handleSaveProxy = async (key: string, proxy_url: string) => {
        setSavingConfig(key);
        try {
            const res = await fetch("/api/admin/providers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, proxy_url }),
            });
            if (!res.ok) {
                const data = await res.json();
                alert(data.error || "Failed to update proxy.");
            }
        } catch { alert("Network error"); }
        setSavingConfig(null);
        fetchProviders();
    };

    const handleInputChange = (key: string, value: string) => {
        setProviders(prev => prev.map(p => p.key === key ? { ...p, proxyUrlInput: value } : p));
        if (testResults[key]) {
            setTestResults(prev => { const n = { ...prev }; delete n[key]; return n; });
        }
    };

    const handleTestProxy = async (key: string, proxy_url: string) => {
        if (!proxy_url) { alert("Proxy URL cannot be empty for testing"); return; }
        setTestingConfig(key);
        setTestResults(prev => ({ ...prev, [key]: { loading: true } }));
        try {
            const res = await fetch("/api/admin/providers/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proxy_url }),
            });
            const data = await res.json();
            setTestResults(prev => ({
                ...prev,
                [key]: res.ok && data.success
                    ? { success: true, latency: data.latency, info: data.data }
                    : { success: false, error: data.error || "Unknown Error" }
            }));
        } catch {
            setTestResults(prev => ({ ...prev, [key]: { success: false, error: "Network/Timeout Error" } }));
        }
        setTestingConfig(null);
    };

    const activeCount = providers.filter(p => p.is_active).length;
    const inactiveCount = providers.length - activeCount;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* ── Modal ── */}
            {showAddModal && (
                <AddProviderModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={fetchProviders}
                />
            )}

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Providers &amp; Proxies</h2>
                    <p className="text-neutral-400 text-sm mt-1">Kelola ISP provider dan konfigurasi proxy untuk pengecekan domain</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-sm rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_28px_rgba(16,185,129,0.35)] shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    Tambah Provider
                </button>
            </div>

            {/* ── Provider Status Section ── */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-neutral-200 flex items-center gap-2">
                        <Network className="w-4 h-4 text-emerald-400" />
                        Provider Status
                        <span className="text-xs font-normal text-neutral-500 ml-1">({providers.length} total)</span>
                    </h3>
                    <div className="flex items-center gap-3 text-xs font-medium">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            {activeCount} Active
                        </span>
                        <span className="text-neutral-700">|</span>
                        <span className="flex items-center gap-1.5 text-rose-400">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            {inactiveCount} Not Active
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="rounded-2xl bg-neutral-900 border border-neutral-800 h-[148px] animate-pulse" />
                        ))}
                    </div>
                ) : providers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-neutral-800 rounded-2xl">
                        <Network className="w-10 h-10 text-neutral-700 mb-3" />
                        <p className="text-neutral-400 font-medium">Belum ada provider</p>
                        <p className="text-neutral-600 text-sm mt-1">Klik "Tambah Provider" untuk menambahkan ISP baru</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Tambah Sekarang
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {providers.map(p => (
                            <ProviderStatusCard
                                key={p.key}
                                provider={p}
                                onToggleActive={handleToggleActive}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* ── Divider ── */}
            <div className="border-t border-neutral-800" />

            {/* ── Proxy Config Section ── */}
            <section className="space-y-4">
                <h3 className="text-base font-semibold text-neutral-200 flex items-center gap-2">
                    <ServerCog className="w-4 h-4 text-amber-400" />
                    Proxy Configuration
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {loading ? (
                        <div className="col-span-full text-center py-10 text-neutral-500">Loading configurations...</div>
                    ) : providers.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-neutral-600 text-sm">
                            Tidak ada provider untuk dikonfigurasi.
                        </div>
                    ) : (
                        providers.map(p => {
                            if (p.proxyUrlInput === undefined) p.proxyUrlInput = p.proxy_url || "";
                            const meta = PROVIDER_META[p.key] ?? DEFAULT_META;
                            const currentTest = testResults[p.key];

                            return (
                                <div key={p.key} className={`glass-card p-6 flex flex-col hover:border-emerald-500/30 transition-colors ${!p.is_active ? "opacity-50" : ""}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center mr-3 border border-neutral-700 text-lg">
                                                {meta.emoji}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-emerald-400">{p.name}</h3>
                                                <div className="text-[10px] text-neutral-500 font-mono tracking-widest">{p.key}</div>
                                            </div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded text-xs font-bold ${p.proxy_url ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                                            {p.proxy_url ? "PROXY SET" : "DEFAULT IP"}
                                        </div>
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center">
                                                <ServerCog className="w-3 h-3 mr-1" /> HTTP/SOCKS Proxy URL
                                            </label>
                                            <input
                                                type="text"
                                                value={p.proxyUrlInput}
                                                onChange={e => handleInputChange(p.key, e.target.value)}
                                                placeholder="http://user:pass@127.0.0.1:8080"
                                                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono"
                                            />
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                            <button
                                                onClick={() => handleTestProxy(p.key, p.proxyUrlInput)}
                                                disabled={testingConfig === p.key || savingConfig === p.key}
                                                className="flex-1 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500 hover:text-neutral-950 text-amber-500 font-semibold py-2 rounded-xl text-sm transition-all flex justify-center items-center disabled:opacity-50"
                                            >
                                                <ActivitySquare className={`w-4 h-4 mr-2 ${testingConfig === p.key && "animate-spin"}`} />
                                                {testingConfig === p.key ? "Testing..." : "Test Connection"}
                                            </button>
                                            <button
                                                onClick={() => handleSaveProxy(p.key, p.proxyUrlInput)}
                                                disabled={savingConfig === p.key || testingConfig === p.key}
                                                className="flex-1 bg-neutral-800 hover:bg-emerald-500 hover:text-neutral-950 text-neutral-300 font-semibold py-2 rounded-xl text-sm transition-all flex justify-center items-center disabled:opacity-50"
                                            >
                                                <Save className="w-4 h-4 mr-2" />
                                                {savingConfig === p.key ? "Saving..." : "Save Config"}
                                            </button>
                                        </div>

                                        {currentTest && !currentTest.loading && (
                                            <div className={`mt-3 p-3 rounded-lg text-xs font-mono border ${currentTest.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"}`}>
                                                {currentTest.success ? (
                                                    <div>
                                                        <div className="flex items-center font-bold mb-1">
                                                            <CheckCircle className="w-3 h-3 mr-1" /> Connection Successful ({currentTest.latency}ms)
                                                        </div>
                                                        <div>IP: <span className="text-emerald-300">{currentTest.info?.query}</span></div>
                                                        <div>Location: {currentTest.info?.city}, {currentTest.info?.country}</div>
                                                        <div>ISP: {currentTest.info?.isp}</div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start">
                                                        <XCircle className="w-4 h-4 mr-1.5 mt-0.5 shrink-0" />
                                                        <span>Error: {currentTest.error}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
}
