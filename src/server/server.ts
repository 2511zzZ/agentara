import type { Server } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";

import type { Logger } from "@/shared";
import { createLogger } from "@/shared";

import { healthRoutes, sessionRoutes, taskRoutes } from "./routes";

/**
 * Creates the Hono app with all API routes mounted.
 *
 * Extracted as a standalone function so TypeScript can infer the full
 * chained route type, which is then exported as {@link AppType} for
 * use with Hono's RPC client (`hc<AppType>`).
 */
function createApp() {
  return new Hono()
    .route("/api", healthRoutes)
    .route("/api/sessions", sessionRoutes)
    .route("/api/tasks", taskRoutes);
}

/**
 * The fully-typed Hono app, including all mounted route signatures.
 *
 * Use with `hc<AppType>` on the client side for end-to-end type safety.
 */
export type AppType = ReturnType<typeof createApp>;

/**
 * The HTTP server wrapping Hono, started and stopped by the Kernel.
 *
 * Serves RESTful API routes under `/api` and, in production mode,
 * static files from the built React SPA at `web/dist/`.
 */
export class HonoServer {
  private _app: AppType;
  private _server: Server<undefined> | undefined;
  private _logger: Logger;

  constructor() {
    this._logger = createLogger("hono-server");
    this._app = createApp();
    this._setupMiddleware();
    this._setupStaticServing();
  }

  get app(): AppType {
    return this._app;
  }

  /**
   * Start listening on the configured host and port.
   *
   * Uses `AGENTARA_SERVICE_PORT` (default 1984) and
   * `AGENTARA_SERVICE_HOST` (default localhost).
   */
  async start(): Promise<void> {
    const port = parseInt(Bun.env.AGENTARA_SERVICE_PORT ?? "1984", 10);
    const hostname = Bun.env.AGENTARA_SERVICE_HOST ?? "localhost";

    this._server = Bun.serve({
      fetch: this._app.fetch,
      port,
      hostname,
    });

    this._logger.info(
      "HTTP server is running on http://" +
        hostname +
        (port === 80 ? "" : ":" + port),
    );
  }

  /**
   * Gracefully shut down the server.
   */
  async stop(): Promise<void> {
    if (this._server) {
      await this._server.stop(true);
      this._logger.info("HTTP server stopped");
    }
  }

  private _setupMiddleware(): void {
    this._app.use("/api/*");
  }

  private _setupStaticServing(): void {
    if (Bun.env.NODE_ENV === "production") {
      this._app.use("/*", serveStatic({ root: "./web/dist" }));
      // SPA fallback: serve index.html for non-API, non-asset routes
      this._app.get("*", serveStatic({ path: "./web/dist/index.html" }));
    }
  }
}
