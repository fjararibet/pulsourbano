import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	geometry: string;
	name: string;
	popupinfo: string;
	longitud_km: number;
};

export const getCicloviasGeoJSON = createServerFn({ method: "GET" }).handler(
	async (): Promise<GeoJSON.FeatureCollection> => {
		const cached =
			await env.ESGRIMAKV.get<GeoJSON.FeatureCollection>("geo:ciclovias");
		if (cached) return cached;
		const { results } = await env.DTPMGEO.prepare(
			"SELECT geometry, name, popupinfo, longitud_km FROM ciclobias",
		).all<Row>();
		const data: GeoJSON.FeatureCollection = {
			type: "FeatureCollection",
			features: results.map((row) => ({
				type: "Feature",
				geometry: JSON.parse(row.geometry) as GeoJSON.Geometry,
				properties: {
					name: row.name,
					popupinfo: row.popupinfo,
					longitud: row.longitud_km,
				},
			})),
		};
		await env.ESGRIMAKV.put("geo:ciclobias", JSON.stringify(data), {
			expirationTtl: 600,
		});
		return data;
	},
);
