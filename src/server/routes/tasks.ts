import { Hono } from "hono";

import { kernel } from "@/kernel";
import { InboundMessageTaskPayload } from "@/shared";

/**
 * Task-related route group.
 */
export const taskRoutes = new Hono()
  .get("/", (c) => {
    const tasks = kernel.taskDispatcher.queryTasks();
    return c.json(tasks);
  })
  .get("/cronjobs", async (c) => {
    const cronjobs = await kernel.taskDispatcher.getCronjobs();
    return c.json(cronjobs);
  })
  .post("/dispatch", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = InboundMessageTaskPayload.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const jobId = await kernel.taskDispatcher.dispatch(parsed.data);
    return c.json({ job_id: jobId });
  });
