import "./000-core/config.js";
import Fastify from "fastify";
import { registerCors } from "./100-middleware/cors.js";
import { registerRoutes } from "./200-routes/register-routes.js";

const app = Fastify({ logger: true });

await registerCors(app);
await registerRoutes(app);

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
