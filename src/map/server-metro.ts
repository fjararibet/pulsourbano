import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	kind: string;
	geometry: string;
	properties: string;
};

export const getMetroGeoJSON = createServerFn({ method: "GET" }).handler(
	async (): Promise<GeoJSON.FeatureCollection> => {
		const { results } = await env.DTPMGEO.prepare(
			"SELECT kind, geometry, properties FROM metro_features",
		).all<Row>();
		return {
			type: "FeatureCollection",
			features: results.map((row) => ({
				type: "Feature",
				geometry: JSON.parse(row.geometry) as GeoJSON.Geometry,
				properties: JSON.parse(row.properties) as Record<string, unknown>,
			})),
		};
	},
);
