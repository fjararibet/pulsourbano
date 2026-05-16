CREATE TABLE `bus_features` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`geometry` text NOT NULL,
	`properties` text NOT NULL
);
