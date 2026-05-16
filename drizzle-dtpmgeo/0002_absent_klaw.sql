CREATE TABLE `bus_frequencies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`route_key` text NOT NULL,
	`bus_route` text,
	`direction` integer,
	`origin` text,
	`mean_headway_seconds` integer,
	`samples` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bus_frequencies_route_key_unique` ON `bus_frequencies` (`route_key`);--> statement-breakpoint
CREATE TABLE `bus_travel_times` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`route_key` text NOT NULL,
	`bus_route` text,
	`direction` integer,
	`origin` text,
	`mean_minutes` integer,
	`mean_km` real,
	`avg_kmh` real,
	`samples` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bus_travel_times_route_key_unique` ON `bus_travel_times` (`route_key`);--> statement-breakpoint
CREATE TABLE `ciclobias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fid` integer,
	`name` text,
	`folderpath` text,
	`popupinfo` text,
	`longitud_km` real,
	`shape_length_m` real,
	`geometry` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comunas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`objectid` integer,
	`cod_comuna` integer,
	`cod_region` integer,
	`nombre_comuna` text,
	`provincia` text,
	`region` text,
	`dis_elec` integer,
	`cir_sena` integer,
	`shape_area` real,
	`shape_length` real,
	`geometry` text NOT NULL
);
