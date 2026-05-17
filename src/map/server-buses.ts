import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	geometry: string;
	properties: string;
};

export const getBusesGeoJSON = createServerFn({ method: "GET" }).handler(
	async (): Promise<GeoJSON.FeatureCollection> => {
		const cached =
			await env.ESGRIMAKV.get<GeoJSON.FeatureCollection>("geo:buses");
		if (cached) return cached;
		const { results } = await env.DTPMGEO.prepare(
			"SELECT geometry, properties FROM bus_features",
		).all<Row>();
		const data: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: results.map((row) => ({
				type: "Feature",
				geometry: JSON.parse(row.geometry) as GeoJSON.Geometry,
				properties: JSON.parse(row.properties) as Record<string, unknown>,
			})),
		};
		await env.ESGRIMAKV.put("geo:buses", JSON.stringify(data), {
			expirationTtl: 600,
		});
		return data;
	},
);
