import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.ts";

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

export const db = drizzle(requireEnv("DATABASE_URL"), { schema });
