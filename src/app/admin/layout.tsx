"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Globe,
    Settings,
    Users,
    LogOut,
    Activity,
    Menu,
    X,
    Network
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Domains", href: "/admin/domains", icon: Globe, restricted: true },
    { name: "Admins", href: "/admin/users", icon: Users, restricted: true },
    { name: "Providers Config", href: "/admin/providers", icon: Network, restricted: true },
    { name: "Telegram Settings", href: "/admin/telegram", icon: Settings, restricted: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/auth/me")
            .then(res => res.json())
            .then(data => {
                if (data && data.role) setUserRole(data.role);
            })
            .catch(() => { });
    }, []);

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    };

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row overflow-hidden">
            {/* Mobile Overlay */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col transition-transform duration-300 transform md:relative md:translate-x-0",
                isMobileOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-16 flex items-center px-6 border-b border-neutral-800">
                    <Activity className="w-6 h-6 text-emerald-500 mr-3" />
                    <span className="font-bold text-lg tracking-wider">NAWALA<span className="text-emerald-500">BAJA</span></span>
                </div>

                <div className="flex-1 py-6 px-4 space-y-2">
                    {navigation.map((item) => {
                        // Admin rank only sees Dashboard
                        if (item.restricted && userRole === "ADMIN") return null;

                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                                    isActive
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5 mr-3", isActive ? "text-emerald-400" : "text-neutral-500")} />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-neutral-800">
                    <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen md:h-auto overflow-hidden">
                <header className="h-16 bg-neutral-900/50 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-4 sm:px-8 shrink-0">
                    <div className="flex items-center">
                        <button
                            className="md:hidden mr-4 p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                            onClick={() => setIsMobileOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <h1 className="text-lg font-semibold text-neutral-200">
                            {navigation.find(n => n.href === pathname)?.name || "Admin Panel"}
                        </h1>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-neutral-950">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
