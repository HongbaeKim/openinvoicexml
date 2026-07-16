import type { FastifyInstance } from "fastify";
import cors from "@fastify/cors";

export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: process.env.ALLOWED_ORIGIN ?? "http://localhost:8080",
  });
}
