import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle",
	schema: ["./src/db/schema.ts", "./src/db/eod-schema.ts"],
	dialect: "sqlite",
});
