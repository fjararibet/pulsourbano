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
		const { results } = await env.DTPMGEO.prepare(
			"SELECT geometry, name, popupinfo, longitud_km FROM ciclovias",
		).all<Row>();
		return {
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
	},
);
