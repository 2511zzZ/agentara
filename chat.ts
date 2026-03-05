import * as readline from "node:readline/promises";

import { Database } from "@/data";
import { SessionManager } from "@/kernel/sessioning";
import * as sessioningSchema from "@/kernel/sessioning/data";
import { logger, type UserMessage, uuid } from "@/shared";

const database = new Database({ ...sessioningSchema });
const sessionManager = new SessionManager(database.db);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  historySize: 100,
});

async function main() {
  const sessionId = uuid();
  let session = await sessionManager.resolveSession(sessionId);
  await Bun.sleep(500);
  while (true) {
    const input = await rl.question("You: ");
    if (input.toLowerCase() === "exit") {
      logger.info("Bye");
      process.exit(0);
    } else if (input.startsWith("/")) {
      const commandString = input.slice(1);
      const [command, ...args] = commandString.split(" ");
      switch (command) {
        case "new":
          session = await sessionManager.createSession();
          logger.info(`Created new session: ${session.id}`);
          break;
        case "resume":
          if (args.length === 0) {
            logger.error(
              "No session ID provided.\nUsage: /resume <session_id>",
            );
            continue;
          }
          const sessionId = args[0]!;
          if (!sessionManager.existsSession(sessionId)) {
            logger.error(`Session ${sessionId} not found`);
            continue;
          }
          session = await sessionManager.resumeSession(sessionId);
          break;
        default:
          logger.error(`Unknown command: ${command}`);
          continue;
      }
    }
    const userMessage: UserMessage = {
      id: uuid(),
      session_id: session.id,
      role: "user",
      content: [{ type: "text", text: input }],
    };
    await session.run(userMessage);
    console.info();
  }
}

await main();
