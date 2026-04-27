"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Lock } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            if (res.ok) {
                router.push("/admin");
            } else {
                const data = await res.json();
                setError(data.error || "Login failed");
            }
        } catch (err) {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
                <div className="p-8 text-center pt-10">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-500/20">
                        <Activity className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Welcome Back</h1>
                    <p className="text-neutral-400 text-sm">Sign in to NawalaBaja Panel</p>
                </div>

                <form onSubmit={handleLogin} className="p-8 pt-0 space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg p-3 text-center">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-600"
                            placeholder="admin"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Password</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-600 pl-11"
                                placeholder="••••••••"
                                required
                            />
                            <Lock className="w-5 h-5 text-neutral-500 absolute left-4 top-3.5" />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold py-3 rounded-xl transition-all duration-200 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Authenticating..." : "Sign In"}
                    </button>
                </form>
            </div>
        </div>
    );
}
