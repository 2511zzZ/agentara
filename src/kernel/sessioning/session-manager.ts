import { existsSync } from "node:fs";

import { config, createLogger, uuid } from "@/shared";

import { Session } from "./session";
import {
  SessionDiaryFileWriter,
  SessionFileWriter,
  SessionLogWriter,
} from "./writers";

/**
 * Options for resolving, creating, or resuming a session.
 * Defaults come from config where applicable.
 */
export interface SessionResolveOptions {
  /**
   * The type of agent runner (e.g. "claude-code").
   * Defaults to `config.agents.default.type`.
   */
  agentType?: string;

  /**
   * The current working directory for the session.
   * Defaults to `config.paths.workspace`.
   */
  cwd?: string;
}

/**
 * Creates or resumes Session instances and maintains session .md files.
 */
export class SessionManager {
  private readonly _diaryWriter = new SessionDiaryFileWriter();
  private readonly _logger = createLogger("session-manager");

  /**
   * Start the session manager.
   */
  async start() {
    this._logger.info("Session manager started");
  }

  /**
   * Returns whether a session with the given id exists.
   * @param sessionId The session identifier.
   * @returns true if the session file exists, false otherwise.
   */
  existsSession(sessionId: string): boolean {
    const path = config.paths.resolveSessionFilePath(sessionId);
    return existsSync(path);
  }

  /**
   * Resolves session by file existence: creates if missing, resumes if exists.
   * @param sessionId The session identifier.
   * @param options Optional agent_type and cwd (default from config).
   * @returns A Session instance.
   */
  async resolveSession(
    sessionId: string,
    options?: SessionResolveOptions,
  ): Promise<Session> {
    if (this.existsSession(sessionId)) {
      return this.resumeSession(sessionId, options);
    }
    return this.createSession(sessionId, options);
  }

  /**
   * Creates a new session with specific ID.
   * @param sessionId The session identifier.
   * @param options Optional agent_type and cwd (default from config).
   * @returns A Session instance with isNewSession: true.
   * @throws SessionAlreadyExistsError if the session file already exists.
   */
  async createSession(
    sessionId = uuid(),
    options?: SessionResolveOptions,
  ): Promise<Session> {
    if (this.existsSession(sessionId)) {
      throw new SessionAlreadyExistsError(sessionId);
    }
    this._logger.info(`Creating session: ${sessionId}`);
    const session = new Session(
      sessionId,
      options?.agentType ?? config.agents.default.type,
      {
        isNewSession: true,
        cwd: options?.cwd ?? config.paths.home,
      },
    );
    this._attachWriter(session, sessionId);
    return session;
  }

  /**
   * Resumes an existing session by verifying the file exists.
   * @param sessionId The session identifier.
   * @param options Optional agent_type and cwd (default from config).
   * @returns A Session instance with isNewSession: false.
   * @throws SessionNotFoundError if the session file does not exist.
   */
  async resumeSession(
    sessionId: string,
    options?: SessionResolveOptions,
  ): Promise<Session> {
    if (!this.existsSession(sessionId)) {
      throw new SessionNotFoundError(sessionId);
    }
    this._logger.info(`Resuming session: ${sessionId}`);
    const session = new Session(
      sessionId,
      options?.agentType ?? config.agents.default.type,
      {
        isNewSession: false,
        cwd: options?.cwd ?? config.paths.home,
      },
    );
    this._attachWriter(session, sessionId);
    return session;
  }

  private _attachWriter(session: Session, sessionId: string): void {
    const fileWriter = new SessionFileWriter(sessionId);
    const logWriter = new SessionLogWriter(sessionId);
    session.on("message", (message) => {
      logWriter.write(message);
      fileWriter.write(message);
      this._diaryWriter.write(message);
    });
  }
}

/**
 * Error thrown when attempting to create a session that already exists.
 */
export class SessionAlreadyExistsError extends Error {
  constructor(
    public readonly sessionId: string,
    message?: string,
  ) {
    super(message ?? `Session already exists: ${sessionId}`);
    this.name = "SessionAlreadyExistsError";
  }
}

/**
 * Error thrown when attempting to resume a session that does not exist.
 */
export class SessionNotFoundError extends Error {
  constructor(
    public readonly sessionId: string,
    message?: string,
  ) {
    super(message ?? `Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}
