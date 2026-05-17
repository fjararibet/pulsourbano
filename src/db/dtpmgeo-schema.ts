import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const busFeatures = sqliteTable("bus_features", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	kind: text().notNull(),
	geometry: text().notNull(),
	properties: text().notNull(),
});

export const metroFeatures = sqliteTable("metro_features", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	kind: text().notNull(),
	geometry: text().notNull(),
	properties: text().notNull(),
});

export const comunas = sqliteTable("comunas", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	objectid: integer({ mode: "number" }),
	cod_comuna: integer({ mode: "number" }),
	cod_region: integer({ mode: "number" }),
	nombre_comuna: text(),
	provincia: text(),
	region: text(),
	dis_elec: integer({ mode: "number" }),
	cir_sena: integer({ mode: "number" }),
	shape_area: real(),
	shape_length: real(),
	geometry: text().notNull(),
});

export const ciclovias = sqliteTable("ciclovias", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	fid: integer({ mode: "number" }),
	name: text(),
	folderpath: text(),
	popupinfo: text(),
	longitud_km: real(),
	shape_length_m: real(),
	geometry: text().notNull(),
});

export const busFrequencies = sqliteTable("bus_frequencies", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	route_key: text().notNull().unique(),
	bus_route: text(),
	direction: integer({ mode: "number" }),
	origin: text(),
	mean_headway_seconds: integer({ mode: "number" }),
	samples: integer({ mode: "number" }),
});

export const busTravelTimes = sqliteTable("bus_travel_times", {
	id: integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
	route_key: text().notNull().unique(),
	bus_route: text(),
	direction: integer({ mode: "number" }),
	origin: text(),
	mean_minutes: integer({ mode: "number" }),
	mean_km: real(),
	avg_kmh: real(),
	samples: integer({ mode: "number" }),
});
