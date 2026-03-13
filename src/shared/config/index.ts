import * as paths from "./paths";

export const config = {
  agents: {
    default: { type: "claude" },
  },
  tasking: {
    /** Maximum number of attempts per job before it is marked as failed. Defaults to 1 (no retries). */
    max_retries: 1,
  },
  messaging: {
    default_channel_id: "9e3eae94-fe88-4043-af40-e7f88943a370", // Falls back to channels[0]?.id when empty
    channels: [
      {
        id: "9e3eae94-fe88-4043-af40-e7f88943a370",
        type: "feishu",
        name: "Tara",
        description: "Tara's default channel",
        params: {
          app_id: Bun.env.FEISHU_APP_ID!,
          app_secret: Bun.env.FEISHU_APP_SECRET!,
          chat_id: "oc_0571b524e6fe1b7191fd4af3e3fe2a5d",
        },
      },
    ],
  },
  paths,
};
