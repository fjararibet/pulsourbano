import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	geometry: string;
	cod_comuna: number;
	nombre_comuna: string;
	provincia: string;
	region: string;
};

export const getComunasGeoJSON = createServerFn({ method: "GET" }).handler(
	async (): Promise<GeoJSON.FeatureCollection> => {
		const { results } = await env.DTPMGEO.prepare(
			"SELECT geometry, cod_comuna, nombre_comuna, provincia, region FROM comunas",
		).all<Row>();
		return {
			type: "FeatureCollection",
			features: results.map((row) => ({
				type: "Feature",
				geometry: JSON.parse(row.geometry) as GeoJSON.Geometry,
				properties: {
					cod_comuna: row.cod_comuna,
					Comuna: row.nombre_comuna,
					Provincia: row.provincia,
					Region: row.region,
				},
			})),
		};
	},
);
