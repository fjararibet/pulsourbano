import type { ExpressionSpecification } from "maplibre-gl";

export const NOISE_DB_MIN = 30;
export const NOISE_DB_MAX = 85;

export const NOISE_BANDS = [
	{ lo: 30, hi: 35, color: "#4ade80" },
	{ lo: 35, hi: 40, color: "#86efac" },
	{ lo: 40, hi: 45, color: "#bbf7d0" },
	{ lo: 45, hi: 50, color: "#d9f99d" },
	{ lo: 50, hi: 55, color: "#fef08a" },
	{ lo: 55, hi: 60, color: "#fdba74" },
	{ lo: 60, hi: 65, color: "#fb923c" },
	{ lo: 65, hi: 70, color: "#ef4444" },
	{ lo: 70, hi: 75, color: "#b91c1c" },
	{ lo: 75, hi: 80, color: "#92400e" },
	{ lo: 80, hi: 85, color: "#4a2a12" },
] as const;

export type NoiseComunaStats = {
	comuna: string;
	dbPromedioComunal: number;
	dbMinComunal: number;
	dbMaxComunal: number;
	accent: string;
};

export type NoiseComunaStatsRecord = Omit<NoiseComunaStats, "accent"> & {
	accent?: string;
};

export function createNoiseColorExpression(
	propertyName = "DB_LO",
): ExpressionSpecification {
	const expression: unknown[] = [
		"step",
		["to-number", ["get", propertyName], NOISE_DB_MIN],
		NOISE_BANDS[0].color,
	];

	for (const band of NOISE_BANDS.slice(1)) {
		expression.push(band.lo, band.color);
	}

	return expression as ExpressionSpecification;
}

export function noiseDbColor(db: number): string {
	let color: string = NOISE_BANDS[0].color;
	for (const band of NOISE_BANDS) {
		if (db >= band.lo) color = band.color;
	}
	return color;
}

export function buildNoiseComunaFeatures(
	statsByComuna: Map<string, NoiseComunaStats>,
	comunas: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
	const features = comunas.features.flatMap((feature) => {
		const properties = feature.properties;
		const comuna =
			readStringProperty(properties, "Comuna") ||
			readStringProperty(properties, "nombre_comuna") ||
			readStringProperty(properties, "COMUNA");
		const stats = statsByComuna.get(normalizeComunaName(comuna));

		if (!stats || !feature.geometry) return [];

		const codComuna = readNumberProperty(properties, "cod_comuna");

		return [
			{
				type: "Feature" as const,
				geometry: feature.geometry,
				properties: {
					COMUNA: stats.comuna,
					dbPromedioComunal: stats.dbPromedioComunal,
					dbMinComunal: stats.dbMinComunal,
					dbMaxComunal: stats.dbMaxComunal,
					accent: stats.accent,
					...(codComuna !== null ? { cod_comuna: codComuna } : {}),
				},
			},
		];
	});

	return { type: "FeatureCollection", features };
}

export function buildNoiseComunaStats(
	stats: readonly NoiseComunaStatsRecord[],
): Map<string, NoiseComunaStats> {
	const statsByComuna = new Map<string, NoiseComunaStats>();

	for (const stat of stats) {
		const comuna = typeof stat.comuna === "string" ? stat.comuna.trim() : "";
		const dbPromedioComunal = readNumberValue(stat.dbPromedioComunal);
		const dbMinComunal = readNumberValue(stat.dbMinComunal);
		const dbMaxComunal = readNumberValue(stat.dbMaxComunal);
		const key = normalizeComunaName(comuna);

		if (
			!key ||
			dbPromedioComunal === null ||
			dbMinComunal === null ||
			dbMaxComunal === null
		) {
			continue;
		}

		if (!statsByComuna.has(key)) {
			statsByComuna.set(key, {
				comuna,
				dbPromedioComunal,
				dbMinComunal,
				dbMaxComunal,
				accent: stat.accent?.trim() || noiseDbColor(dbPromedioComunal),
			});
		}
	}

	return statsByComuna;
}

export function getNoiseComunaStats(
	statsByComuna: Map<string, NoiseComunaStats>,
	comuna: string | null,
) {
	return comuna
		? (statsByComuna.get(normalizeComunaName(comuna)) ?? null)
		: null;
}

export function filterComunasWithNoiseData(
	statsByComuna: Map<string, NoiseComunaStats>,
	comunas: GeoJSON.FeatureCollection,
): GeoJSON.FeatureCollection {
	return {
		type: "FeatureCollection",
		features: comunas.features.filter((feature) => {
			const properties = feature.properties;
			const comuna =
				readStringProperty(properties, "Comuna") ||
				readStringProperty(properties, "nombre_comuna") ||
				readStringProperty(properties, "COMUNA");

			return statsByComuna.has(normalizeComunaName(comuna));
		}),
	};
}

function readStringProperty(
	properties: GeoJSON.GeoJsonProperties,
	key: string,
): string {
	const value = properties?.[key];
	return typeof value === "string" ? value.trim() : "";
}

function readNumberProperty(
	properties: GeoJSON.GeoJsonProperties,
	key: string,
): number | null {
	return readNumberValue(properties?.[key]);
}

function readNumberValue(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const numberValue = typeof value === "number" ? value : Number(value);
	return Number.isFinite(numberValue) ? numberValue : null;
}

export function normalizeComunaName(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase()
		.trim();
}
