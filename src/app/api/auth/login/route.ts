import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import argon2 from "argon2";
import { encrypt } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ error: "Username dan password wajib diisi." }, { status: 400 });
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
            maxAge: 60 * 60 * 24, // 24 jam
        });

        return response;
    } catch (error: any) {
        console.error("[LOGIN ERROR]", error?.message, error?.code, JSON.stringify(error));
        return NextResponse.json({
            error: "Internal Server Error",
            detail: process.env.NODE_ENV !== "production" ? error?.message : undefined
        }, { status: 500 });
    }
}
