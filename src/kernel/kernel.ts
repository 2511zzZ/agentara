import {
  createLogger,
  extractTextContent,
  type InboundMessageTaskPayload,
} from "@/shared";

import { HonoServer } from "../server";

import { SessionManager } from "./sessioning";
import { TaskDispatcher } from "./tasking";

/**
 * The kernel is the main entry point for the agentara application.
 * Lazy-creation singleton: the instance is created on first `getInstance()`.
 */
class Kernel {
  private _sessionManager!: SessionManager;
  private _taskDispatcher!: TaskDispatcher;
  private _honoServer!: HonoServer;
  private _logger = createLogger("kernel");

  constructor() {
    this._initSessionManager();
    this._initTaskDispatcher();
    this._initServer();
  }

  get sessionManager(): SessionManager {
    return this._sessionManager;
  }

  get taskDispatcher(): TaskDispatcher {
    return this._taskDispatcher;
  }

  get honoServer(): HonoServer {
    return this._honoServer;
  }

  private _initSessionManager(): void {
    this._sessionManager = new SessionManager();
  }

  private _initServer(): void {
    this._honoServer = new HonoServer();
  }

  private _initTaskDispatcher(): void {
    // TODO: Add task dispatcher configuration
    this._taskDispatcher = new TaskDispatcher();
    this._taskDispatcher.route("inbound_message", this._inboundMessageHandler);
  }

  /**
   * Start the kernel.
   */
  async start(): Promise<void> {
    await this._sessionManager.start();
    await this._taskDispatcher.start();
    await this._honoServer.start();
  }

  private _inboundMessageHandler = async (
    payload: InboundMessageTaskPayload,
  ) => {
    const sessionId = payload.session_id;
    const session = await this._sessionManager.resolveSession(sessionId);
    const inboundMessage = payload.message;
    this._logger.info(
      {
        session_id: sessionId,
        inbound_message: extractTextContent(inboundMessage),
      },
      "inbound_message handler executing",
    );
    const outboundMessage = await session.run(inboundMessage);
    this._logger.info(
      {
        session_id: sessionId,
        inbound_message: extractTextContent(inboundMessage),
        outbound_message: extractTextContent(outboundMessage),
      },
      "inbound_message handler executed",
    );
  };
}

export const kernel = new Kernel();
