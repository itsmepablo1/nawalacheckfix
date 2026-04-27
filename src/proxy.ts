import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

const protectedRoutes = ["/admin", "/api/admin"];
const publicRoutes = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function proxy(request: NextRequest) {
    const path = request.nextUrl.pathname;

    if (path === '/') {
        return NextResponse.redirect(new URL("/admin", request.url));
    }

    const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));
    const isPublicRoute = publicRoutes.some(route => path.startsWith(route));

    const session = await getSession(request);

    if (isProtectedRoute && !session?.id) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    if (isPublicRoute && session?.id && path.startsWith("/login")) {
        return NextResponse.redirect(new URL("/admin", request.url));
    }

    // Role-based route protection:
    // ADMIN role hanya diblokir dari halaman UI tertentu,
    // tapi SEMUA API request (/api/admin/*) tetap diizinkan
    // agar tombol delete, toggle, dsb. bisa berjalan dari semua role.
    if (session?.role === "ADMIN") {
        const restrictedUiPaths = [
            "/admin/domains",
            "/admin/users",
            "/admin/telegram",
            "/admin/providers",
        ];
        // Hanya blokir halaman UI (bukan API)
        if (restrictedUiPaths.some(r => path.startsWith(r))) {
            return NextResponse.redirect(new URL("/admin", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
