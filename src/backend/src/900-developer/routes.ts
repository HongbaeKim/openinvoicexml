import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { bodySchema, EMAIL_RE, type DeveloperSignupBody } from "./schema.js";
import { insertDeveloperSignup, isUniqueViolation } from "./repository.js";

export const developerRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post<{ Body: DeveloperSignupBody }>(
    "/api/developer",
    { schema: { body: bodySchema } },
    async (request, reply) => {
      const { email, consent, website, role, roleOther } = request.body;

      if (website) {
        return reply.code(201).send({ status: "ok" });
      }

      if (!consent) {
        return reply.code(400).send({ error: "consent is required" });
      }

      if (role === "other" && !roleOther?.trim()) {
        return reply.code(400).send({ error: "roleOther is required when role is other" });
      }

      if (!EMAIL_RE.test(email)) {
        return reply.code(400).send({ error: "invalid email" });
      }

      try {
        await insertDeveloperSignup(request.body);
        return reply.code(201).send({ status: "ok" });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return reply.code(200).send({ status: "already_signed_up" });
        }
        request.log.error(err);
        return reply.code(500).send({ error: "internal error" });
      }
    },
  );
};
