import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import argon2 from "argon2";
import { encrypt } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        // ── DEV BYPASS ── hardcoded admin account for local development
        if (username === "admin" && password === "admin123") {
            const token = await encrypt({ id: 1, username: "admin", role: "MASTER" });
            const response = NextResponse.json({ success: true, role: "MASTER" });
            response.cookies.set({
                name: "session",
                value: token,
                httpOnly: true,
                secure: false,
                path: "/",
                maxAge: 60 * 60 * 24,
            });
            return response;
        }

        const prisma = getPrisma();
        const admin = await prisma.admin.findUnique({
            where: { username },
        });

        if (!admin) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const isValid = await argon2.verify(admin.password_hash, password);
        if (!isValid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const token = await encrypt({ id: admin.id, username: admin.username, role: admin.role });

        const response = NextResponse.json({ success: true, role: admin.role });
        response.cookies.set({
            name: "session",
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            maxAge: 60 * 60 * 24, // 24 hours
        });

        return response;
    } catch (error) {
        console.error("Login route error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
