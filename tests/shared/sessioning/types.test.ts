import { describe, expect, test } from "bun:test";

import { Session } from "@/shared";

describe("Session", () => {
  const now = Date.now();
  const validSession = {
    id: "sess-1",
    agent_type: "claude-code",
    cwd: "/home/user/project",
    channel_id: "ch-1",
    first_message: "hello",
    runner_session_id: "runner-sess-1",
    last_message_created_at: now,
    created_at: now,
    updated_at: now,
  };

  test("parses valid session", () => {
    const result = Session.parse(validSession);
    expect(result.id).toBe("sess-1");
    expect(result.agent_type).toBe("claude-code");
    expect(result.channel_id).toBe("ch-1");
  });

  test("accepts null for nullable fields", () => {
    const input = {
      ...validSession,
      channel_id: null,
      runner_session_id: null,
      last_message_created_at: null,
    };
    const result = Session.parse(input);
    expect(result.channel_id).toBeNull();
    expect(result.runner_session_id).toBeNull();
    expect(result.last_message_created_at).toBeNull();
  });

  test("rejects missing required field", () => {
    // eslint-disable-next-line no-unused-vars
    const { id: _id, ...rest } = validSession;
    expect(() => Session.parse(rest)).toThrow();
  });

  test("rejects invalid type for cwd", () => {
    expect(() => Session.parse({ ...validSession, cwd: 123 })).toThrow();
  });
});
