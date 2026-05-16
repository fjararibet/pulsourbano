declare module "cloudflare:workers" {
	interface D1Database {
		prepare(sql: string): {
			all<T = unknown>(): Promise<{ results: T[] }>;
		};
	}

	export const env: {
		EOD2012: D1Database;
		DTPMGEO: D1Database;
		ADDITIONAL_EXAMPLE_DB: D1Database;
	};
}
