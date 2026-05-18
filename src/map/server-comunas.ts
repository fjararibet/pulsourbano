import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import proj4 from "proj4";
import { z } from "zod";

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

type ODViajeRow = {
	origenCoordX: number;
	origenCoordY: number;
	destinoCoordX: number;
	destinoCoordY: number;
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

const UTM_TO_WGS84 = (x: number, y: number): [number, number] => {
	const result = proj4("EPSG:32719", "EPSG:4326", [x, y]);
	return result as [number, number];
};

const NORMALIZE = (s: string) =>
	s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export const getComunaOD = createServerFn({ method: "GET" })
	.inputValidator(z.object({ nombreComuna: z.string() }))
	.handler(async (ctx): Promise<GeoJSON.FeatureCollection> => {
		const asciiComuna = NORMALIZE(ctx.data.nombreComuna);
		const { results } = await env.EOD2012.prepare(
			`SELECT
				v.origenCoordX,
				v.origenCoordY,
				v.destinoCoordX,
				v.destinoCoordY
			FROM viaje v
			WHERE v.comunaOrigen = (
				SELECT id FROM comuna WHERE
					REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
						UPPER(comuna),'Ñ','N'),'Á','A'),'É','E'),'Í','I'),'Ó','O'),'Ú','U')
					= '${asciiComuna.replace(/'/g, "''")}'
				LIMIT 1
			)
			ORDER BY RANDOM()
			LIMIT 500`,
		).all<ODViajeRow>();

		return {
			type: "FeatureCollection" as const,
			features: results
				.filter(
					(r) =>
						r.origenCoordX &&
						r.origenCoordY &&
						r.destinoCoordX &&
						r.destinoCoordY,
				)
				.map((r) => {
					const origin = UTM_TO_WGS84(r.origenCoordX, r.origenCoordY);
					const dest = UTM_TO_WGS84(r.destinoCoordX, r.destinoCoordY);
					if (
						!Number.isFinite(origin[0]) ||
						!Number.isFinite(origin[1]) ||
						!Number.isFinite(dest[0]) ||
						!Number.isFinite(dest[1])
					) {
						return null;
					}
					return {
						type: "Feature" as const,
						geometry: {
							type: "LineString" as const,
							coordinates: [origin, dest],
						},
						properties: {},
					};
				})
				.filter((f): f is NonNullable<typeof f> => f !== null),
		};
	});
