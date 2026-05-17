import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	geometry: string;
	objectid: number | null;
	cod_comuna: number;
	cod_region: number | null;
	nombre_comuna: string;
	provincia: string;
	region: string;
	dis_elec: number | null;
	cir_sena: number | null;
	shape_area: number | null;
	shape_length: number | null;
};

export const getComunasGeoJSON = createServerFn({ method: "GET" }).handler(
	async (): Promise<GeoJSON.FeatureCollection> => {
		const { results } = await env.DTPMGEO.prepare(
			`SELECT geometry, objectid, cod_comuna, cod_region, nombre_comuna, provincia, region, dis_elec, cir_sena, shape_area, shape_length FROM comunas`,
		).all<Row>();
		return {
			type: "FeatureCollection",
			features: results.map((row) => ({
				type: "Feature",
				geometry: JSON.parse(row.geometry) as GeoJSON.Geometry,
				properties: {
					objectid: row.objectid,
					cod_comuna: row.cod_comuna,
					codregion: row.cod_region,
					Comuna: row.nombre_comuna,
					Provincia: row.provincia,
					Region: row.region,
					dis_elec: row.dis_elec,
					cir_sena: row.cir_sena,
					st_area_sh: row.shape_area,
					st_length_: row.shape_length,
				},
			})),
		};
	},
);
