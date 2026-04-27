"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, CheckCircle, AlertTriangle, XCircle, Trash2, Globe, X, Check } from "lucide-react";

type Domain = {
    id: string;
    domain: string;
    group_name: string | null;
    is_active: boolean;
    createdAt: string;
    checks: any[];
};

function StatusBadge({ checks }: { checks: any[] }) {
    if (!checks || checks.length === 0) {
        return <span className="inline-flex items-center text-xs font-semibold text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded border border-neutral-700">WAITING</span>;
    }
    const status = checks[0].status;
    if (status === "AMAN") return (
        <span className="inline-flex items-center text-xs font-semibold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/20">
            <CheckCircle className="w-3 h-3 mr-1.5" /> AMAN
        </span>
    );
    if (status === "BLOCKIR") return (
        <span className="inline-flex items-center text-xs font-semibold text-rose-400 bg-rose-400/10 px-2.5 py-1 rounded border border-rose-400/20">
            <AlertTriangle className="w-3 h-3 mr-1.5" /> BLOCKIR
        </span>
    );
    if (status === "REDIRECT" || status === "TIMEOUT") return (
        <span className="inline-flex items-center text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/20">
            <AlertTriangle className="w-3 h-3 mr-1.5" /> {status}
        </span>
    );
    return <span className="inline-flex items-center text-xs font-semibold text-neutral-400 bg-neutral-800 px-2.5 py-1 rounded border border-neutral-700">{status}</span>;
}

export default function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addInput, setAddInput] = useState("");

    // Inline delete confirmation: stores the id currently pending confirmation
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchDomains = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/domains?search=${encodeURIComponent(search)}&page=${page}&pageSize=50`);
            const data = await res.json();
            if (data.domains) {
                setDomains(data.domains);
                setTotal(data.total);
            }
        } catch (error) {
            console.error("Failed to load domains", error);
        } finally {
            setLoading(false);
        }
    }, [search, page]);

    useEffect(() => {
        const timeout = setTimeout(fetchDomains, 400);
        return () => clearTimeout(timeout);
    }, [fetchDomains]);

    const handleAddDomains = async (e: React.FormEvent) => {
        e.preventDefault();
        const lines = addInput.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;

        const payload = lines.map(line => ({ domain: line, group_name: "Default", is_active: true }));

        const res = await fetch("/api/admin/domains", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domains: payload }),
        });

        if (res.ok) {
            setAddInput("");
            setIsAddModalOpen(false);
            setPage(1);
            fetchDomains();
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Gagal menambah domain.");
        }
    };

    // Step 1: first click → show inline confirm
    const handleDeleteClick = (id: string) => {
        if (pendingDeleteId === id) {
            // Already in confirm state → cancel
            setPendingDeleteId(null);
        } else {
            setPendingDeleteId(id);
        }
    };

    // Step 2: confirm click → actually delete
    const handleConfirmDelete = async (id: string) => {
        setDeletingId(id);
        setPendingDeleteId(null);
        try {
            const res = await fetch(`/api/admin/domains?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                setDomains(prev => prev.filter(d => d.id !== id));
                setTotal(prev => prev - 1);
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || "Gagal menghapus domain.");
            }
        } catch {
            alert("Network error. Coba lagi.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Domain Management</h2>
                    <p className="text-neutral-400 text-sm mt-1">Kelola dan pantau domain yang dicek ({total} total)</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold py-2 px-6 rounded-xl flex items-center transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_28px_rgba(16,185,129,0.35)]"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Domain
                </button>
            </div>

            {/* Search */}
            <div className="glass-card p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Cari domain..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-neutral-600"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-neutral-400">
                        <thead className="bg-neutral-900/50 border-b border-neutral-800 text-xs uppercase font-semibold text-neutral-500">
                            <tr>
                                <th className="px-6 py-4">Domain</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Group</th>
                                <th className="px-6 py-4 text-right">Ditambahkan</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {loading && domains.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-neutral-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-4 h-4 border-2 border-neutral-600 border-t-emerald-500 rounded-full animate-spin" />
                                            Memuat domain...
                                        </div>
                                    </td>
                                </tr>
                            ) : domains.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-neutral-500">
                                        Tidak ada domain ditemukan
                                    </td>
                                </tr>
                            ) : (
                                domains.map(d => {
                                    const isPending = pendingDeleteId === d.id;
                                    const isDeleting = deletingId === d.id;
                                    return (
                                        <tr
                                            key={d.id}
                                            className={`transition-colors group ${isPending ? "bg-rose-500/5" : "hover:bg-neutral-900/30"}`}
                                            onClick={() => { if (pendingDeleteId && pendingDeleteId !== d.id) setPendingDeleteId(null); }}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <Globe className="w-4 h-4 mr-3 text-neutral-600 group-hover:text-emerald-500 transition-colors shrink-0" />
                                                    <span className="font-medium text-white">{d.domain}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge checks={d.checks} />
                                            </td>
                                            <td className="px-6 py-4">{d.group_name || "–"}</td>
                                            <td className="px-6 py-4 text-right text-neutral-500 text-xs">
                                                {new Date(d.createdAt).toLocaleDateString("id-ID")}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {isDeleting ? (
                                                    <div className="flex items-center justify-end">
                                                        <div className="w-4 h-4 border-2 border-neutral-600 border-t-rose-500 rounded-full animate-spin" />
                                                    </div>
                                                ) : isPending ? (
                                                    /* Inline confirm row */
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span className="text-xs text-rose-400 font-medium">Hapus domain ini?</span>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleConfirmDelete(d.id); }}
                                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold transition-all"
                                                        >
                                                            <Check className="w-3 h-3" /> Ya
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setPendingDeleteId(null); }}
                                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-all"
                                                        >
                                                            <X className="w-3 h-3" /> Batal
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); handleDeleteClick(d.id); }}
                                                        className="text-neutral-500 hover:text-rose-400 transition-colors p-2 hover:bg-rose-500/10 rounded-lg"
                                                        title="Hapus Domain"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between">
                    <div className="text-sm text-neutral-500">
                        Menampilkan {domains.length} dari {total} domain
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-800 rounded-lg text-white font-medium transition-colors text-sm"
                        >
                            ← Sebelumnya
                        </button>
                        <span className="px-4 py-2 text-sm text-neutral-500">Hal. {page}</span>
                        <button
                            disabled={domains.length < 50}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed border border-neutral-800 rounded-lg text-white font-medium transition-colors text-sm"
                        >
                            Berikutnya →
                        </button>
                    </div>
                </div>
            </div>

            {/* Add Domains Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="glass-card w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                            <div>
                                <h3 className="text-lg font-bold text-white">Tambah Domain</h3>
                                <p className="text-xs text-neutral-500 mt-0.5">Satu domain per baris</p>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddDomains} className="p-6 space-y-4">
                            <textarea
                                value={addInput}
                                onChange={e => setAddInput(e.target.value)}
                                placeholder={"contoh.com\nexample.org\ntest.net"}
                                rows={7}
                                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono text-sm placeholder:text-neutral-600 resize-none"
                                required
                                autoFocus
                            />
                            <p className="text-xs text-neutral-600">
                                Maksimal 50 domain sekaligus. Group name default: "Default".
                            </p>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-5 py-2 rounded-xl border border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800 font-medium transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={!addInput.trim()}
                                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold py-2 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                                >
                                    Import Domain
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
