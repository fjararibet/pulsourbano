import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	route_key: string;
	mean_minutes: number;
	mean_km: number;
	avg_kmh: number;
	samples: number;
};

export type TravelTimeMap = Record<
	string,
	{ mean_minutes: number; mean_km: number; avg_kmh: number; samples: number }
>;

export const getTravelTimes = createServerFn({ method: "GET" }).handler(
	async (): Promise<TravelTimeMap> => {
		const { results } = await env.DTPMGEO.prepare(
			"SELECT route_key, mean_minutes, mean_km, avg_kmh, samples FROM bus_travel_times",
		).all<Row>();
		const map: TravelTimeMap = {};
		for (const row of results) {
			map[row.route_key] = {
				mean_minutes: row.mean_minutes,
				mean_km: row.mean_km,
				avg_kmh: row.avg_kmh,
				samples: row.samples,
			};
		}
		return map;
	},
);
