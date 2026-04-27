"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, Globe, AlertTriangle, CheckCircle, RefreshCw, Play, Clock } from "lucide-react";

type StatCardProps = { title: string; value: string; icon: any; color: string; trend?: string };

function StatCard({ title, value, icon: Icon, color, trend }: StatCardProps) {
    return (
        <div className="glass-card p-6 flex items-start justify-between group">
            <div>
                <h3 className="text-neutral-400 text-sm font-medium mb-2">{title}</h3>
                <div className="text-3xl font-bold tracking-tight text-white mb-1">{value}</div>
                {trend && <div className="text-xs text-neutral-500">{trend}</div>}
            </div>
            <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-400 group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    );
}

type CheckState = "idle" | "running" | "done" | "error";

export default function DashboardPage() {
    const [stats, setStats] = useState({ totalDomains: 0, checkedToday: 0, currentlyBlocked: 0 });
    const [domainsData, setDomainsData] = useState<any[]>([]);
    const [providers, setProviders] = useState<any[]>([]);
    const [dashLoading, setDashLoading] = useState(true);

    // Separate state for check trigger
    const [checkState, setCheckState] = useState<CheckState>("idle");
    const [checkMessage, setCheckMessage] = useState("");
    const [lastChecked, setLastChecked] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/dashboard");
            const data = await res.json();
            if (data?.stats) {
                setStats(data.stats);
                setDomainsData(data.domains || []);
                setProviders(data.providers || []);
            }
        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setDashLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
        const interval = setInterval(fetchDashboard, 15000);
        return () => clearInterval(interval);
    }, [fetchDashboard]);

    const triggerChecks = async () => {
        if (checkState === "running") return;

        setCheckState("running");
        setCheckMessage("Menjalankan pengecekan domain...");

        try {
            const res = await fetch("/api/admin/checks/trigger", { method: "POST" });
            const data = await res.json();

            if (res.ok && data.success) {
                setCheckState("done");
                setCheckMessage(data.message || "Pengecekan selesai.");
                setLastChecked(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
                // Refresh dashboard to show new results
                await fetchDashboard();
            } else {
                setCheckState("error");
                setCheckMessage(data.message || data.error || "Pengecekan gagal.");
            }
        } catch (error) {
            setCheckState("error");
            setCheckMessage("Network error. Coba lagi.");
        }

        // Reset to idle after 6 seconds
        setTimeout(() => {
            setCheckState("idle");
            setCheckMessage("");
        }, 6000);
    };

    const btnConfig = {
        idle:    { label: "Run Checks Now",   icon: Play,       cls: "bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_28px_rgba(16,185,129,0.35)]" },
        running: { label: "Sedang Mengecek…", icon: RefreshCw,  cls: "bg-neutral-700 text-neutral-300 cursor-not-allowed" },
        done:    { label: "Selesai ✓",        icon: CheckCircle,cls: "bg-emerald-600 text-white" },
        error:   { label: "Gagal — Coba Lagi",icon: AlertTriangle, cls: "bg-rose-600 hover:bg-rose-500 text-white" },
    }[checkState];

    const BtnIcon = btnConfig.icon;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">System Overview</h2>
                    <p className="text-neutral-400 text-sm mt-1">Status akses domain secara real-time</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={triggerChecks}
                        disabled={checkState === "running"}
                        className={`font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-all disabled:opacity-80 ${btnConfig.cls}`}
                    >
                        <BtnIcon className={`w-4 h-4 ${checkState === "running" ? "animate-spin" : ""}`} />
                        {btnConfig.label}
                    </button>
                    {/* Status feedback */}
                    {checkMessage && (
                        <span className={`text-xs font-medium ${
                            checkState === "done" ? "text-emerald-400"
                            : checkState === "error" ? "text-rose-400"
                            : "text-neutral-400 animate-pulse"
                        }`}>
                            {checkMessage}
                        </span>
                    )}
                    {lastChecked && checkState === "idle" && (
                        <span className="flex items-center gap-1 text-[11px] text-neutral-600">
                            <Clock className="w-3 h-3" /> Terakhir cek: {lastChecked}
                        </span>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Domain" value={stats.totalDomains.toString()} icon={Globe} color="blue" trend="Domain aktif terdaftar" />
                <StatCard title="Domain Dicek" value={stats.checkedToday.toString()} icon={Activity} color="emerald" trend="Dalam 24 jam terakhir" />
                <StatCard title="Domain Diblokir" value={stats.currentlyBlocked.toString()} icon={AlertTriangle} color="red" trend="Perlu perhatian" />
            </div>

            {/* Provider Status */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Provider Status</h3>
                    {providers.length > 0 && (
                        <div className="flex items-center gap-3 text-xs font-medium">
                            <span className="flex items-center gap-1.5 text-emerald-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                {providers.filter(p => p.is_active).length} Active
                            </span>
                            <span className="text-neutral-700">|</span>
                            <span className="flex items-center gap-1.5 text-rose-400">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                {providers.filter(p => !p.is_active).length} Not Active
                            </span>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {dashLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="glass border border-neutral-800 p-4 rounded-xl animate-pulse h-20 bg-neutral-900/50" />
                        ))
                    ) : providers.length === 0 ? (
                        <div className="text-neutral-500 text-sm col-span-6">Belum ada provider dikonfigurasi</div>
                    ) : (
                        providers.map(provider => (
                            <div key={provider.key} className={`glass border p-4 rounded-xl flex flex-col gap-2 transition-all
                                ${provider.is_active ? "border-neutral-700 hover:border-emerald-500/40" : "border-neutral-800 opacity-55"}`}>
                                <span className="text-sm font-bold text-white">{provider.name}</span>
                                <span className="text-[10px] text-neutral-500 font-mono">{provider.key}</span>
                                {provider.is_active ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 w-fit">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        ACTIVE
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25 w-fit">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        NOT ACTIVE
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Domain Status Table */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-white">Domain Status</h3>
                    <a href="/admin/domains" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                        Lihat Semua Domain →
                    </a>
                </div>
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-neutral-400 whitespace-nowrap">
                            <thead className="bg-neutral-900/50 border-b border-neutral-800 text-xs font-semibold text-white">
                                <tr>
                                    <th className="px-4 py-4 text-center border-r border-neutral-800/50">#</th>
                                    <th className="px-6 py-4 border-r border-neutral-800/50">Domain</th>
                                    {providers.map(p => (
                                        <th key={p.key} className="px-4 py-4 text-center border-r border-neutral-800/50 last:border-r-0">{p.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {dashLoading ? (
                                    <tr>
                                        <td colSpan={providers.length + 2} className="px-6 py-10 text-center">
                                            <div className="flex items-center justify-center gap-2 text-neutral-500">
                                                <div className="w-4 h-4 border-2 border-neutral-600 border-t-emerald-500 rounded-full animate-spin" />
                                                Memuat data...
                                            </div>
                                        </td>
                                    </tr>
                                ) : domainsData.length === 0 ? (
                                    <tr>
                                        <td colSpan={providers.length + 2} className="px-6 py-10 text-center text-neutral-500">
                                            Belum ada domain. Tambahkan di tab Domains.
                                        </td>
                                    </tr>
                                ) : (
                                    domainsData.map((d, index) => (
                                        <tr key={d.id} className="hover:bg-neutral-900/30 transition-colors">
                                            <td className="px-4 py-3 text-center text-neutral-600 border-r border-neutral-800/50 text-xs">{index + 1}</td>
                                            <td className="px-6 py-3 font-medium text-blue-400 border-r border-neutral-800/50">{d.domain}</td>
                                            {providers.map(p => {
                                                const check = d.checks?.find((c: any) => c.provider_key === p.key);
                                                let statusColor = "text-neutral-500 bg-neutral-800/50 border-neutral-700/50";
                                                let statusText = p.is_active ? "–" : "OFF";

                                                if (check) {
                                                    if (check.status === "AMAN") {
                                                        statusColor = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
                                                        statusText = "AMAN";
                                                    } else if (check.status === "BLOCKIR") {
                                                        statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
                                                        statusText = "BLOCKIR";
                                                    } else if (check.status === "TIMEOUT") {
                                                        statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                                                        statusText = "TIMEOUT";
                                                    } else if (check.status === "REDIRECT") {
                                                        statusColor = "text-sky-400 bg-sky-500/10 border-sky-500/20";
                                                        statusText = "REDIRECT";
                                                    }
                                                }

                                                return (
                                                    <td key={`${d.id}-${p.key}`} className="px-4 py-3 text-center border-r border-neutral-800/50 last:border-r-0">
                                                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded border ${statusColor}`}>
                                                            {statusText}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
