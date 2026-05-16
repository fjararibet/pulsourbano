import { defineConfig } from "drizzle-kit";

export default defineConfig({
	out: "./drizzle-dtpmgeo",
	schema: ["./src/db/dtpmgeo-schema.ts"],
	dialect: "sqlite",
});
