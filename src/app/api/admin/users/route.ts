import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import * as argon2 from "argon2";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session || session.role === "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const prisma = getPrisma();
        const admins = await prisma.admin.findMany({
            select: { id: true, username: true, role: true, createdAt: true },
            orderBy: { createdAt: "desc" }
        });
        return NextResponse.json({ admins });
    } catch (error) {
        console.error("Failed to fetch admins:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession(req);
        // Only MASTER and SUPER_ADMIN can create users
        if (!session || session.role === "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const body = await req.json();
        const { username, password, role } = body;

        if (!username || !password || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Only MASTER can create another MASTER
        if (role === "MASTER" && session.role !== "MASTER") {
            return NextResponse.json({ error: "Only MASTER can create MASTER accounts" }, { status: 403 });
        }

        const prisma = getPrisma();
        const existing = await prisma.admin.findUnique({ where: { username } });
        if (existing) {
            return NextResponse.json({ error: "Username already exists" }, { status: 400 });
        }

        const password_hash = await argon2.hash(password);

        const admin = await prisma.admin.create({
            data: { username, password_hash, role },
            select: { id: true, username: true, role: true, createdAt: true }
        });

        return NextResponse.json({ success: true, admin });
    } catch (error: any) {
        console.error("Failed to create admin:", error);
        return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession(req);
        if (!session || session.role === "ADMIN") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const url = new URL(req.url);
        const id = url.searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing admin ID" }, { status: 400 });
        }

        const prisma = getPrisma();

        const targetAdmin = await prisma.admin.findUnique({ where: { id } });
        if (!targetAdmin) {
            return NextResponse.json({ error: "Admin not found" }, { status: 404 });
        }

        // Enforce role hierarchy for deletion
        if (targetAdmin.role === "MASTER") {
            return NextResponse.json({ error: "Cannot delete MASTER account" }, { status: 403 });
        }
        if (targetAdmin.role === "SUPER_ADMIN" && session.role !== "MASTER") {
            return NextResponse.json({ error: "Only MASTER can delete SUPER_ADMIN accounts" }, { status: 403 });
        }
        await prisma.admin.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Failed to delete admin:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
