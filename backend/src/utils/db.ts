import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

let prismaInstance: PrismaClient | null = null;

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to initialize Prisma.");
  }

  const adapter = new PrismaPg(new pg.Pool({ connectionString: process.env.DATABASE_URL }));
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }
  return prismaInstance;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    return getPrismaClient()[property as keyof PrismaClient];
  },
});

export default prisma;
