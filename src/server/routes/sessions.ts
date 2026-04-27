import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { kernel } from "@/kernel";
import { SessionNotFoundError } from "@/kernel/sessioning";
import type { Message } from "@/shared";
import { config } from "@/shared";

/**
 * Session-related route group.
 */
export const sessionRoutes = new Hono()
  .get("/", (c) => {
    const limit = Number(c.req.query("limit")) || undefined;
    const sessions = kernel.sessionManager.querySessions({ limit });
    return c.json(sessions);
  })
  .delete("/:id", (c) => {
    const id = c.req.param("id");
    try {
      kernel.sessionManager.removeSession(id);
      return c.body(null, 204);
    } catch (err) {
      if (err instanceof SessionNotFoundError) {
        throw new HTTPException(404, { message: err.message });
      }
      throw err;
    }
  })
  .get("/:id/history", async (c) => {
    const id = c.req.param("id");
    let messages: Message[];
    try {
      const file = Bun.file(config.paths.resolveSessionFilePath(id));
      const jsonl = (await file.text()).trim();
      messages = jsonl.split("\n").map((line) => JSON.parse(line));
      return c.json({ messages });
    } catch {
      throw new HTTPException(404, { message: "Session not found" });
    }
  });
