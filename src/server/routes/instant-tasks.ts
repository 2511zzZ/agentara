import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { kernel } from "@/kernel";
import { uuid } from "@/shared";

/**
 * Request body for dispatching an instant task.
 */
const InstantTaskBody = z.object({
  /** Optional session ID. When omitted, a new session is created. */
  session_id: z.string().uuid().optional(),
  /** The instruction string sent to the agent. */
  instruction: z.string(),
  /** The working directory for the session. */
  cwd: z.string(),
});

/**
 * Instant tasks route group.
 */
export const instantTaskRoutes = new Hono().post(
  "/",
  zValidator("json", InstantTaskBody),
  async (c) => {
    const body = c.req.valid("json");
    const sessionId = body.session_id ?? uuid();
    const taskId = await kernel.taskDispatcher.dispatch(sessionId, {
      type: "instant_task",
      instruction: body.instruction,
      cwd: body.cwd,
    });
    return c.json({ ok: true, task_id: taskId, session_id: sessionId }, 202);
  },
);
