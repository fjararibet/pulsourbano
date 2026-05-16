import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const busFeatures = sqliteTable("bus_features", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	kind: text().notNull(),
	geometry: text().notNull(),
	properties: text().notNull(),
});
