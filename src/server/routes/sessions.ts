import { Hono } from "hono";

import { kernel } from "@/kernel";
import { config } from "@/shared";

/**
 * Session-related route group.
 */
export const sessionRoutes = new Hono()
  .get("/", (c) => {
    const sessions = kernel.sessionManager.querySessions();
    return c.json(sessions);
  })
  .get("/:id/history", async (c) => {
    const id = c.req.param("id");
    const file = Bun.file(config.paths.resolveSessionFilePath(id));
    const jsonl = (await file.text()).trim();
    const messages = jsonl.split("\n").map((line) => JSON.parse(line));
    return c.json({ messages });
  });
