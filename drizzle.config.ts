import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/kernel/*/data/schema.ts",
  dialect: "sqlite",
});
