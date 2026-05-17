declare module "cloudflare:workers" {
	interface D1Database {
		prepare(sql: string): {
			all<T = unknown>(): Promise<{ results: T[] }>;
		};
	}
	interface KVNamespace {
		get<T = unknown>(key: string): Promise<T | null>;
		put(
			key: string,
			value: string,
			options?: { expirationTtl?: number },
		): Promise<void>;
		delete(key: string): Promise<void>;
	}

	export const env: {
		EOD2012: D1Database;
		DTPMGEO: D1Database;
		ADDITIONAL_EXAMPLE_DB: D1Database;
		ESGRIMAKV: KVNamespace;
	};
}
