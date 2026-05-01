// @ts-nocheck
/* eslint-disable */
/**
 * prisma.config.ts — Prisma 7 config untuk CLI (db push, migrate)
 * datasource.url wajib ada di sini (bukan di schema.prisma)
 */
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export default defineConfig({
    schema: path.join("prisma", "schema.prisma"),
    datasource: {
        url: process.env.DATABASE_URL!,
    },
});
