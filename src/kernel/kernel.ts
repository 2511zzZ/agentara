import { FeishuMessageChannel } from "@/community/feishu";
import * as feishuMessagingSchema from "@/community/feishu/messaging/data";
import { DataConnection } from "@/data";
import type { AssistantMessage, UserMessage } from "@/shared";
import {
  config,
  createLogger,
  extractTextContent,
  reloadConfig,
  uuid,
  type InboundMessageTaskPayload,
  type InstantTaskPayload,
  type ScheduledTaskPayload,
} from "@/shared";
import {
  resetRegistry,
  resolveChannelForProject,
  resolveProjectForChannel,
} from "@/shared/config/channel-project-registry";

import { HonoServer } from "../server";

import { MultiChannelMessageGateway } from "./messaging";
import type { Session } from "./sessioning";
import { SessionManager } from "./sessioning";
import * as sessioningSchema from "./sessioning/data";
import { TaskDispatcher } from "./tasking";
import * as taskingSchema from "./tasking/data";

/**
 * The kernel is the main entry point for the agentara application.
 * Lazy-creation singleton: the instance is created on first `getInstance()`.
 */
class Kernel {
  private _logger = createLogger("kernel");
  private _database!: DataConnection;
  private _sessionManager!: SessionManager;
  private _taskDispatcher!: TaskDispatcher;
  private _messageGateway!: MultiChannelMessageGateway;
  private _honoServer!: HonoServer;

  constructor() {
    this._initDatabase();
    this._initSessionManager();
    this._initTaskDispatcher();
    this._initMessageGateway();
    this._initServer();
  }

  get database(): DataConnection {
    return this._database;
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

  private _initDatabase(): void {
    this._database = new DataConnection({
      ...taskingSchema,
      ...sessioningSchema,
      ...feishuMessagingSchema,
    });
  }

  private _initSessionManager(): void {
    this._sessionManager = new SessionManager(this._database.db);
  }

  private _initServer(): void {
    this._honoServer = new HonoServer();
  }

  private _initTaskDispatcher(): void {
    this._taskDispatcher = new TaskDispatcher({
      db: this._database.db,
    });
    this._taskDispatcher.route(
      "inbound_message",
      this._handleInboundMessageTask,
    );
    this._taskDispatcher.route("scheduled_task", this._handleScheduledTask);
    this._taskDispatcher.route("instant_task", this._handleInstantTask);
  }

  private _initMessageGateway(): void {
    this._messageGateway = new MultiChannelMessageGateway(this._database.db);
    const defaultChannelId = config.messaging.default_channel_id;
    let fallbackChannel: FeishuMessageChannel | undefined;
    const siblingChannels: Array<{ chatId: string; channel: FeishuMessageChannel }> = [];

    for (const channel of config.messaging.channels) {
      const isDefault = channel.id === defaultChannelId;
      const feishuChannel = new FeishuMessageChannel(
        channel.id,
        {
          chatId: channel.params.chat_id!,
          appId: channel.params.app_id!,
          appSecret: channel.params.app_secret!,
          ownerOpenId: channel.params.owner_open_id,
          fallback: isDefault,
        },
        this._database.db,
      );
      if (isDefault) {
        fallbackChannel = feishuChannel;
      } else {
        siblingChannels.push({ chatId: channel.params.chat_id!, channel: feishuChannel });
      }
      this._messageGateway.registerChannel(feishuChannel);
    }

    if (fallbackChannel) {
      for (const { chatId, channel } of siblingChannels) {
        fallbackChannel.registerSibling(chatId, channel);
      }
    }
    this._messageGateway.onChannelMiss = () => this._reloadChannels();
    this._messageGateway.on("message:inbound", this._handleInboundMessage);
    this._messageGateway.on("message:recalled", this._handleMessageRecall);
  }

  private _reloadChannels(): void {
    reloadConfig();
    resetRegistry();

    const defaultChannelId = config.messaging.default_channel_id;
    const fallbackChannel = this._messageGateway.getChannel(defaultChannelId) as FeishuMessageChannel | undefined;

    for (const channelConfig of config.messaging.channels) {
      if (this._messageGateway.hasChannel(channelConfig.id)) continue;

      this._logger.info(`Registering new channel from config: ${channelConfig.id}`);
      const feishuChannel = new FeishuMessageChannel(
        channelConfig.id,
        {
          chatId: channelConfig.params.chat_id!,
          appId: channelConfig.params.app_id!,
          appSecret: channelConfig.params.app_secret!,
          ownerOpenId: channelConfig.params.owner_open_id,
          fallback: false,
        },
        this._database.db,
      );
      this._messageGateway.registerChannel(feishuChannel);
      if (fallbackChannel) {
        fallbackChannel.registerSibling(channelConfig.params.chat_id!, feishuChannel);
      }
    }
  }

  /**
   * Start the kernel.
   */
  async start(): Promise<void> {
    await this._sessionManager.start();
    await this._taskDispatcher.start();
    await this._honoServer.start();
    await this._messageGateway.start();
  }

  private _handleInboundMessage = async (message: UserMessage) => {
    const text = extractTextContent(message).trim();

    // Handle /stop command
    if (text === "/stop") {
      await this._handleStopCommand(message);
      return;
    }

    const task: InboundMessageTaskPayload = {
      type: "inbound_message",
      message,
    };
    await this._taskDispatcher.dispatch(message.session_id, task);
  };

  private _handleStopCommand = async (message: UserMessage) => {
    const sessionId = message.session_id;
    const runningTaskId =
      this._taskDispatcher.getRunningTaskForSession(sessionId);

    if (runningTaskId) {
      await this._taskDispatcher.deleteTask(runningTaskId);
      await this._messageGateway.replyMessage(message.id, {
        role: "assistant",
        session_id: sessionId,
        content: [{ type: "text", text: "Task stopped." }],
      });
    } else {
      await this._messageGateway.replyMessage(message.id, {
        role: "assistant",
        session_id: sessionId,
        content: [{ type: "text", text: "No running task found." }],
      });
    }
  };

  private _handleMessageRecall = async (
    messageId: string,
    channelId: string,
  ) => {
    const taskId = this._taskDispatcher.getTaskByMessageId(messageId);
    if (taskId) {
      await this._taskDispatcher.deleteTask(taskId);
      this._logger.info(
        { message_id: messageId, task_id: taskId, channel_id: channelId },
        "task stopped due to message recall",
      );
    }
  };

  /**
   * Stream a session's output into a Feishu message, updating it progressively.
   * Shared by inbound, instant, and scheduled task handlers.
   *
   * @param session - The resolved session to stream from.
   * @param userMessage - The user (or synthetic) message to send to the agent.
   * @param anchorMessageId - The Feishu message ID to update with streamed content.
   * @param signal - Optional abort signal.
   * @returns The final assistant message content array.
   */
  private _streamToMessage = async (
    session: Session,
    userMessage: UserMessage,
    anchorMessageId: string,
    signal?: AbortSignal,
  ): Promise<AssistantMessage["content"]> => {
    const contents: AssistantMessage["content"] = [];
    const stream = await session.stream(userMessage, { signal });
    for await (const message of stream) {
      if (message.role === "assistant") {
        contents.push(...message.content);
        await this._messageGateway.updateMessageContent(
          {
            id: anchorMessageId,
            role: "assistant",
            session_id: session.id,
            content: contents,
          },
          { streaming: true },
        );
      }
    }
    if (contents.length === 0) {
      throw new Error("No assistant message received from the agent.");
    }
    await this._messageGateway.updateMessageContent(
      {
        id: anchorMessageId,
        role: "assistant",
        session_id: session.id,
        content: contents,
      },
      { streaming: false },
    );
    return contents;
  };

  private _handleInboundMessageTask = async (
    _taskId: string,
    sessionId: string,
    payload: InboundMessageTaskPayload,
    signal?: AbortSignal,
  ) => {
    const inboundMessage = payload.message;
    const session = await this._sessionManager.resolveSession(sessionId, {
      channelId: inboundMessage.channel_id,
      firstMessage: inboundMessage,
    });
    const outboundMessage = await this._messageGateway.replyMessage(
      inboundMessage.id,
      {
        role: "assistant",
        session_id: session.id,
        content: [{ type: "thinking", thinking: "Thinking..." }],
      },
      { streaming: true },
    );
    await this._streamToMessage(session, inboundMessage, outboundMessage.id, signal);
  };

  private _handleScheduledTask = async (
    _taskId: string,
    sessionId: string,
    payload: ScheduledTaskPayload,
    signal?: AbortSignal,
  ) => {
    let defaultChannelId = payload.project_name
      ? resolveChannelForProject(payload.project_name)
      : undefined;
    if (!defaultChannelId && payload.project_name) {
      this._reloadChannels();
      defaultChannelId = resolveChannelForProject(payload.project_name);
    }
    defaultChannelId ??= config.messaging.default_channel_id;
    const { instruction, type: _taskType, project_name: _pn, ...scheduleMeta } = payload;
    void _taskType;
    const userMessage: UserMessage = {
      id: uuid(),
      role: "user",
      session_id: sessionId,
      channel_id: defaultChannelId,
      content: [
        {
          type: "text",
          text: `> This message is automatically triggered by a scheduled task.
> The time is now ${new Date().toString()}.
> Cron expression: \`${JSON.stringify(scheduleMeta)}\`

${instruction}`,
        },
      ],
    };
    const session = await this._sessionManager.resolveSession(sessionId, {
      cwd: config.paths.home,
      channelId: userMessage.channel_id,
      firstMessage: userMessage,
    });
    const briefInstruction = instruction.slice(0, 200) + (instruction.length > 200 ? "..." : "");
    const anchorMessage = {
      role: "assistant" as const,
      session_id: session.id,
      content: [
        { type: "text" as const, text: `**⏳ Scheduled Task**\n> ${briefInstruction}` },
      ],
    };
    const isProjectChannel = !!resolveProjectForChannel(defaultChannelId);
    const anchor = isProjectChannel
      ? await this._messageGateway.postMessage(anchorMessage)
      : await this._messageGateway.sendDirectMessage(defaultChannelId, anchorMessage);
    const contents = await this._streamToMessage(session, userMessage, anchor.id, signal);
    const skipped = contents
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .some((c) => c.text.includes("[SKIPPED]"));
    if (skipped) {
      await this._messageGateway.updateMessageContent(
        { ...anchor, content: [{ type: "text", text: "Task skipped." }] },
        { streaming: false },
      );
    }
    await this._messageGateway.replyTextInThread(
      anchor.id,
      session.id,
      skipped ? "Task skipped." : "✅ 在此话题下继续对话",
    );
  };

  private _handleInstantTask = async (
    _taskId: string,
    sessionId: string,
    payload: InstantTaskPayload,
    signal?: AbortSignal,
  ) => {
    let channelId = payload.project_name
      ? resolveChannelForProject(payload.project_name)
      : undefined;
    if (!channelId && payload.project_name) {
      this._reloadChannels();
      channelId = resolveChannelForProject(payload.project_name);
    }
    channelId ??= config.messaging.default_channel_id;
    const userMessage: UserMessage = {
      id: uuid(),
      role: "user",
      session_id: sessionId,
      channel_id: channelId,
      content: [
        {
          type: "text",
          text: `> This message is triggered by an instant task.
> The time is now ${new Date().toString()}.

${payload.instruction}`,
        },
      ],
    };
    const session = await this._sessionManager.resolveSession(sessionId, {
      cwd: payload.cwd,
      channelId: userMessage.channel_id,
      firstMessage: userMessage,
    });
    const briefInstruction = payload.instruction.slice(0, 200) + (payload.instruction.length > 200 ? "..." : "");
    const anchorMessage = {
      role: "assistant" as const,
      session_id: session.id,
      content: [
        { type: "text" as const, text: `**⏳ Instant Task**\n> ${briefInstruction}` },
      ],
    };
    const isProjectChannel = !!resolveProjectForChannel(channelId);
    const anchor = isProjectChannel
      ? await this._messageGateway.postMessage(anchorMessage)
      : await this._messageGateway.sendDirectMessage(channelId, anchorMessage);
    const contents = await this._streamToMessage(session, userMessage, anchor.id, signal);
    const skipped = contents
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .some((c) => c.text.includes("[SKIPPED]"));
    if (skipped) {
      await this._messageGateway.updateMessageContent(
        { ...anchor, content: [{ type: "text", text: "Task skipped." }] },
        { streaming: false },
      );
    }
    await this._messageGateway.replyTextInThread(
      anchor.id,
      session.id,
      skipped ? "Task skipped." : "✅ 在此话题下继续对话",
    );
  };
}

export const kernel = new Kernel();
