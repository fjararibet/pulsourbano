import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	route_key: string;
	mean_headway_seconds: number;
	samples: number;
};

export type FrequencyMap = Record<
	string,
	{ mean_headway_s: number; samples: number }
>;

export const getFrequencies = createServerFn({ method: "GET" }).handler(
	async (): Promise<FrequencyMap> => {
		const cached = await env.ESGRIMAKV.get<FrequencyMap>("sim:frequencies");
		if (cached) return cached;
		const { results } = await env.DTPMGEO.prepare(
			"SELECT route_key, mean_headway_seconds, samples FROM bus_frequencies",
		).all<Row>();
		const map: FrequencyMap = {};
		for (const row of results) {
			map[row.route_key] = {
				mean_headway_s: row.mean_headway_seconds,
				samples: row.samples,
			};
		}
		await env.ESGRIMAKV.put("sim:frequencies", JSON.stringify(map), {
			expirationTtl: 600,
		});
		return map;
	},
);
