declare module "cloudflare:workers" {
	export const env: {
		DB: {
			prepare(sql: string): {
				all<T = unknown>(): Promise<{ results: T[] }>;
			};
		};
	};
}
