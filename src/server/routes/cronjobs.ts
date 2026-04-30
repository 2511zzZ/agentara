import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { kernel } from "@/kernel";
import { TaskSchedule } from "@/shared";

/**
 * Request body for creating or updating a scheduled task.
 * When `session_id` is omitted, each trigger creates a fresh session (independent mode).
 */
const ScheduleTaskBody = z.object({
  /**
   * The session ID that owns this scheduled task.
   * When omitted (POST) or undefined (PUT), creates/keeps independent or existing.
   * When null, explicitly sets independent mode. When a UUID, sets contextual mode.
   */
  session_id: z.string().uuid().optional().nullable(),
  /** The instruction string sent to the agent. */
  instruction: z.string(),
  /** Optional working directory for the session. Falls back to config.paths.home. */
  cwd: z.string().optional(),
  /** Optional project name this task belongs to. Routes output to project channel. */
  project_name: z.string().optional(),
  /** The schedule configuration describing when to run. */
  schedule: TaskSchedule,
});

/**
 * Cronjobs (scheduled tasks) route group.
 */
export const cronjobsRoutes = new Hono()
  .get("/", (c) => {
    const scheduledTasks = kernel.taskDispatcher.getScheduledTasks();
    return c.json(scheduledTasks);
  })
  .post("/", zValidator("json", ScheduleTaskBody), async (c) => {
    const body = c.req.valid("json");
    const sessionId = body.session_id ?? null;
    const schedulerId = await kernel.taskDispatcher.scheduleTask(
      sessionId,
      {
        type: "scheduled_task",
        instruction: body.instruction,
        ...(body.cwd ? { cwd: body.cwd } : {}),
        ...(body.project_name ? { project_name: body.project_name } : {}),
      },
      body.schedule,
    );
    return c.json(
      { ok: true, id: schedulerId, session_id: sessionId },
      201,
    );
  })
  .put(
    "/:schedulerId",
    zValidator("json", ScheduleTaskBody),
    async (c) => {
      const schedulerId = c.req.param("schedulerId");
      const body = c.req.valid("json");
      try {
        await kernel.taskDispatcher.updateScheduledTask(
          schedulerId,
          {
            type: "scheduled_task",
            instruction: body.instruction,
            ...(body.cwd ? { cwd: body.cwd } : {}),
            ...(body.project_name ? { project_name: body.project_name } : {}),
          },
          body.schedule,
          body.session_id,
        );
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.startsWith("Scheduled task not found:")
        ) {
          throw new HTTPException(404, { message: "Cronjob not found" });
        }
        throw err;
      }
      const updated = kernel.taskDispatcher.getScheduledTasks().find(
        (t) => t.id === schedulerId,
      );
      return c.json({
        ok: true,
        id: schedulerId,
        session_id: updated?.session_id ?? null,
      });
    },
  )
  .delete("/:schedulerId", async (c) => {
    const schedulerId = c.req.param("schedulerId");
    await kernel.taskDispatcher.removeScheduledTask(schedulerId);
    return c.json({ ok: true, id: schedulerId });
  });
