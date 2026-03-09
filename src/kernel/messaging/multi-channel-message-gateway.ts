import { eq } from "drizzle-orm";
import EventEmitter from "eventemitter3";

import type { DrizzleDB } from "@/data";
import type {
  AssistantMessage,
  MessageChannel,
  MessageGateway,
  MessageGatewayEventTypes,
  UserMessage,
} from "@/shared";
import { createLogger } from "@/shared";

import { sessions } from "../sessioning/data";

/**
 * A gateway that manages multiple message channels, routes outbound messages
 * to the correct channel based on session `channel_type`, and emits unified
 * inbound events.
 */
export class MultiChannelMessageGateway
  extends EventEmitter<MessageGatewayEventTypes>
  implements MessageGateway
{
  private _logger = createLogger("message-gateway");
  private _channels: Map<string, MessageChannel> = new Map();
  private _db: DrizzleDB;

  constructor(db: DrizzleDB) {
    super();
    this._db = db;
  }

  /**
   * Register a message channel with the gateway.
   * Subscribes to the channel's `message:inbound` event and re-emits it.
   * @param channel - The message channel to register.
   */
  registerChannel(channel: MessageChannel): void {
    if (this._channels.has(channel.type)) {
      throw new Error(`Channel type "${channel.type}" is already registered.`);
    }
    this._channels.set(channel.type, channel);
    channel.on("message:inbound", (message: UserMessage) => {
      this._handleInboundMessage(channel.type, message);
    });
    this._logger.info(`Registered channel: ${channel.type}`);
  }

  /**
   * Start the gateway and all registered channels.
   */
  async start(): Promise<void> {
    for (const [type, channel] of this._channels) {
      this._logger.info(`Starting channel: ${type}`);
      await channel.start();
    }
    this._logger.info("Message gateway started");
  }

  /**
   * Post a new assistant message without replying to an existing message.
   * Routes to the correct channel based on session `channel_type`.
   * @param message - The assistant message to post (without id).
   * @returns The posted message with id assigned.
   */
  async postMessage(
    message: Omit<AssistantMessage, "id">,
  ): Promise<AssistantMessage> {
    const channel = this._resolveChannelForSession(message.session_id);
    const result = await channel.postMessage(message);
    return result;
  }

  /**
   * Reply to an existing message.
   * Routes to the correct channel based on session `channel_type`.
   * @param messageId - ID of the message to reply to.
   * @param message - The assistant message to send (without id).
   * @param options - Optional settings (e.g. streaming mode).
   * @returns The sent message with id assigned.
   */
  async replyMessage(
    messageId: string,
    message: Omit<AssistantMessage, "id">,
    options?: { streaming?: boolean },
  ): Promise<AssistantMessage> {
    const channel = this._resolveChannelForSession(message.session_id);
    const result = await channel.replyMessage(messageId, message, options);
    return result;
  }

  /**
   * Update the content of an existing message.
   * Routes to the correct channel based on session `channel_type`.
   * @param message - The assistant message with updated content.
   * @param options - Optional settings (e.g. streaming mode).
   */
  async updateMessageContent(
    message: AssistantMessage,
    options?: { streaming?: boolean },
  ): Promise<void> {
    const channel = this._resolveChannelForSession(message.session_id);
    await channel.updateMessageContent(message, options);
  }

  /**
   * Handles an inbound message from a channel: sets the channel_type on the
   * message and re-emits `message:inbound`.
   */
  private _handleInboundMessage(
    channelType: string,
    message: UserMessage,
  ): void {
    message.channel_type = channelType;
    this.emit("message:inbound", message);
  }

  /**
   * Resolves the correct channel for a session by querying the `channel_type`
   * column from the sessions table.
   * @param sessionId - The session identifier.
   * @returns The matching MessageChannel.
   * @throws If the session has no channel_type or the channel is not registered.
   */
  private _resolveChannelForSession(sessionId: string): MessageChannel {
    const row = this._db
      .select({ channel_type: sessions.channel_type })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!row?.channel_type) {
      throw new Error(
        `Cannot resolve channel for session "${sessionId}": no channel_type set.`,
      );
    }

    return this._resolveChannel(row.channel_type);
  }

  /**
   * Looks up a registered channel by type.
   * @param channelType - The channel type identifier.
   * @returns The matching MessageChannel.
   * @throws If the channel type is not registered.
   */
  private _resolveChannel(channelType: string): MessageChannel {
    const channel = this._channels.get(channelType);
    if (!channel) {
      throw new Error(`Channel type "${channelType}" is not registered.`);
    }
    return channel;
  }
}
