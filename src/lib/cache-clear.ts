import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

const CACHE_KEYS = [
	"geo:buses",
	"geo:metro",
	"geo:ciclobias",
	"geo:comunas",
	"sim:frequencies",
	"sim:travel_times",
] as const;

export const clearCache = createServerFn({ method: "POST" }).handler(
	async () => {
		const kv = env.ESGRIMAKV;
		await Promise.all(CACHE_KEYS.map((key) => kv.delete(key)));
		return { cleared: CACHE_KEYS };
	},
);
