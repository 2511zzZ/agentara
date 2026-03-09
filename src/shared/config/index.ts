import * as paths from "./paths";

export const config = {
  agents: {
    default: { type: "claude" },
  },
  tasking: {
    /** Maximum number of attempts per job before it is marked as failed. Defaults to 1 (no retries). */
    max_retries: 1,
  },
  paths,
};
