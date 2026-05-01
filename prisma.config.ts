// @ts-nocheck
/* eslint-disable */
/**
 * prisma.config.ts — Prisma 7 adapter config untuk CLI commands (db push, migrate)
 * Dibutuhkan karena Prisma 7 tidak support `url` di schema.prisma lagi.
 */
import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

export default defineConfig({
    schema: path.join("prisma", "schema.prisma"),
    migrate: {
        async adapter(env) {
            const pool = new Pool({
                connectionString: env.DATABASE_URL,
            });
            return new PrismaPg(pool);
        },
    },
});
