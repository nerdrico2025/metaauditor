import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "../migrations",
  schema: "./src/infrastructure/database/schema.ts",
  dialect: "postgresql",
});