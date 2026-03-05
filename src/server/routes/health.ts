import { Hono } from "hono";

const startTime = Date.now();

/**
 * Health check route group.
 */
export const healthRoutes = new Hono().get("/health", (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  return c.json({ status: "ok" as const, uptime });
});
