"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Shield, Trash2 } from "lucide-react";

export default function AdminsPage() {
    const [admins, setAdmins] = useState<any[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ username: "", password: "", role: "ADMIN" });
    const [loading, setLoading] = useState(true);
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (data.admins) {
                setAdmins(data.admins);
            }
        } catch (error) {
            console.error("Failed to load admins:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
        fetch("/api/auth/me")
            .then(res => res.json())
            .then(data => {
                if (data && data.role) setCurrentUserRole(data.role);
            })
            .catch(() => { });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json();

            if (res.ok) {
                setFormData({ username: "", password: "", role: "ADMIN" });
                setShowModal(false);
                fetchAdmins();
            } else {
                alert(data.error || "Failed to create admin");
            }
        } catch (error) {
            alert("Network error occurred");
        }
    };

    const handleDelete = async (id: string, username: string) => {
        if (!confirm(`Are you sure you want to delete the admin ${username}?`)) return;

        try {
            const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                fetchAdmins();
            } else {
                alert("Failed to delete admin");
            }
        } catch (error) {
            alert("Network error occurred");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Admin Managers</h2>
                    <p className="text-neutral-400 text-sm mt-1">Manage panel access and roles</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-2.5 px-6 rounded-xl flex items-center transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Admin
                </button>
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full text-left text-sm text-neutral-400">
                    <thead className="bg-neutral-900/50 border-b border-neutral-800 text-xs uppercase font-semibold text-neutral-500">
                        <tr>
                            <th className="px-6 py-4">Username</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Created</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                        {loading && admins.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-neutral-500">Loading admins...</td></tr>
                        ) : (
                            admins.map((admin) => (
                                <tr key={admin.id} className="hover:bg-neutral-900/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center mr-3 border border-neutral-700">
                                            <Users className="w-4 h-4 text-neutral-400" />
                                        </div>
                                        {admin.username}
                                    </td>
                                    <td className="px-6 py-4">
                                        {admin.role === "MASTER" && (
                                            <span className="text-purple-400 font-medium text-xs bg-purple-400/10 px-2.5 py-1 rounded flex items-center inline-flex border border-purple-400/20">
                                                <Shield className="w-3 h-3 mr-1" /> MASTER
                                            </span>
                                        )}
                                        {admin.role === "SUPER_ADMIN" && (
                                            <span className="text-amber-400 font-medium text-xs bg-amber-400/10 px-2.5 py-1 rounded flex items-center inline-flex border border-amber-400/20">
                                                <Shield className="w-3 h-3 mr-1" /> SUPER ADMIN
                                            </span>
                                        )}
                                        {admin.role === "ADMIN" && (
                                            <span className="text-neutral-300 font-medium text-xs bg-neutral-800 px-2.5 py-1 rounded inline-flex border border-neutral-700">
                                                ADMIN
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">{new Date(admin.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        {((currentUserRole === "MASTER" && admin.role !== "MASTER") ||
                                            (currentUserRole === "SUPER_ADMIN" && admin.role === "ADMIN")) && (
                                                <button
                                                    onClick={() => handleDelete(admin.id, admin.username)}
                                                    className="text-neutral-500 hover:text-red-400 p-1 transition-colors hover:bg-neutral-800 rounded"
                                                    title="Delete Admin"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-neutral-800">
                            <h3 className="text-xl font-bold text-white">Add New Admin</h3>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Username</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Password</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Role</label>
                                <select
                                    className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="ADMIN">ADMIN (View & Check Only)</option>
                                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full Access)</option>
                                    {currentUserRole === "MASTER" && (
                                        <option value="MASTER">MASTER (System Owner)</option>
                                    )}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2.5 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-2.5 rounded-xl transition-colors"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
