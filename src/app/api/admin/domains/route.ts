import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const search = url.searchParams.get("search") || "";
        const page = parseInt(url.searchParams.get("page") || "1");
        const pageSize = parseInt(url.searchParams.get("pageSize") || "50");

        const whereClause = search
            ? { domain: { contains: search, mode: "insensitive" as const } }
            : {};

        const prisma = getPrisma();

        const [domains, total] = await Promise.all([
            prisma.domain.findMany({
                where: whereClause,
                include: {
                    checks: {
                        orderBy: { checked_at: "desc" },
                        take: 1, // Only get the latest check status
                    },
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: "desc" },
            }),
            prisma.domain.count({ where: whereClause }),
        ]);

        return NextResponse.json({ domains, total, page, pageSize });
    } catch (error) {
        console.error("Failed to fetch domains:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const prisma = getPrisma();

        if (Array.isArray(data.domains)) {
            // Bulk Import
            const created = await Promise.all(
                data.domains.map(async (d: any) => {
                    return prisma.domain.upsert({
                        where: { domain: d.domain },
                        update: { group_name: d.group_name, is_active: d.is_active },
                        create: { domain: d.domain, group_name: d.group_name, is_active: d.is_active !== false }
                    });
                })
            );
            return NextResponse.json({ success: true, count: created.length });
        } else {
            // Single Create
            const { domain, group_name, is_active } = data;
            const created = await prisma.domain.create({
                data: { domain, group_name, is_active: is_active ?? true },
            });
            return NextResponse.json(created);
        }
    } catch (error) {
        console.error("Failed to create domain:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Missing domain ID" }, { status: 400 });
        }

        const prisma = getPrisma();
        await prisma.domain.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete domain:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
