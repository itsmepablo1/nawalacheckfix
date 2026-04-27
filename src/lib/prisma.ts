import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const getPrisma = () => {
  if (!globalForPrisma.prisma) {
    // Instantiate Pool and Adapter only at runtime inside this lazy getter
    // This avoids connection string parsing errors during Next.js static build when DATABASE_URL is missing
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);

    globalForPrisma.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
};
