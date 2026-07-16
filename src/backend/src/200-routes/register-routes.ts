import type { FastifyInstance } from "fastify";
import { betaRoutes } from "../800-beta/routes.js";
import { developerRoutes } from "../900-developer/routes.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(betaRoutes);
  await app.register(developerRoutes);
  app.get("/health", async () => ({ status: "ok" }));
}
