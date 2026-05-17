import type { MapGeoJSONFeature } from "maplibre-gl";
import type { FrequencyInfo, TravelTimeInfo } from "./types";

/** Descarga un GeoJSON estático desde `public/data/`. Devuelve `null` si falla. */
export async function loadGeoJSON(
	url: string,
): Promise<GeoJSON.FeatureCollection | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return (await response.json()) as GeoJSON.FeatureCollection;
	} catch {
		return null;
	}
}

/** Descarga un JSON genérico. Devuelve `null` si falla. */
export async function loadJSON<T>(url: string): Promise<T | null> {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		return (await response.json()) as T;
	} catch {
		return null;
	}
}

/** Lee una propiedad string de un feature, con fallback a "". */
export function getFeatureString(feature: MapGeoJSONFeature, key: string) {
	const value = feature.properties?.[key];
	if (value === null || value === undefined) return "";
	return String(value);
}

/** Lee una propiedad numérica. Devuelve `null` si no parsea. */
export function getFeatureNumber(feature: MapGeoJSONFeature, key: string) {
	const value = feature.properties?.[key];
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

/** Convierte un headway en segundos a una etiqueta legible. */
export function formatHeadway(frequency: FrequencyInfo) {
	return `Pasa cada: ${formatHeadwayMinutes(frequency)}`;
}

export function formatHeadwayShort(frequency: FrequencyInfo) {
	return `cada ${formatHeadwayMinutes(frequency)}`;
}

export function formatHeadwayMinutes(frequency: FrequencyInfo) {
	return formatMinutes(Math.max(1, Math.round(frequency.mean_headway_s / 60)));
}

export function formatTravelTime(time: TravelTimeInfo) {
	return `Viaje aprox.: ${formatMinutes(time.mean_minutes)}`;
}

export function formatTravelTimeShort(time: TravelTimeInfo) {
	return `${formatMinutes(time.mean_minutes)} aprox.`;
}

function formatMinutes(minutes: number) {
	const rounded = Math.max(1, Math.round(minutes));
	if (rounded < 60) return `${rounded} min`;
	const hours = Math.floor(rounded / 60);
	const rest = rounded % 60;
	return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

/**
 * Limpia nombres de estación de Metro y paraderos RED, que en GTFS vienen
 * con prefijos del tipo "RED-", "I/L1 - ", "(M)", etc.
 */
export function formatStationName(value: string) {
	return value
		.replace(/^[^-]+-/, "")
		.replace(/^.*?\/\s*/, "")
		.replace(/^\(M\)\s*/i, "")
		.trim();
}

/** Escapa HTML para inyectar texto seguro en el popup de MapLibre. */
export function escapeHtml(value: string) {
	return value.replace(/[&<>'"]/g, (char) => {
		const entities: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			"'": "&#39;",
			'"': "&quot;",
		};
		return entities[char] ?? char;
	});
}

/** Calcula el centroide aproximado de un feature Polygon/MultiPolygon. */
export function getPolygonCentroid(
	feature: GeoJSON.Feature,
): [number, number] | null {
	if (!feature.geometry) return null;
	const coords: [number, number][] = [];
	if (feature.geometry.type === "Polygon") {
		for (const ring of feature.geometry.coordinates) {
			for (const point of ring) {
				const x = point[0] as number | undefined;
				const y = point[1] as number | undefined;
				if (x !== undefined && y !== undefined) coords.push([x, y]);
			}
		}
	} else if (feature.geometry.type === "MultiPolygon") {
		for (const polygon of feature.geometry.coordinates) {
			for (const ring of polygon) {
				for (const point of ring) {
					const x = point[0] as number | undefined;
					const y = point[1] as number | undefined;
					if (x !== undefined && y !== undefined) coords.push([x, y]);
				}
			}
		}
	}
	if (coords.length === 0) return null;
	let lon = 0;
	let lat = 0;
	for (const [x, y] of coords) {
		lon += x;
		lat += y;
	}
	return [lon / coords.length, lat / coords.length];
}

/** Genera un arco cuadrático pronunciado (LineString) entre dos puntos. */
export function createArcLineString(
	start: [number, number],
	end: [number, number],
	segments = 80,
): GeoJSON.Feature<GeoJSON.LineString> {
	const midLng = (start[0] + end[0]) / 2;
	const midLat = (start[1] + end[1]) / 2;
	const dx = end[0] - start[0];
	const dy = end[1] - start[1];
	const dist = Math.sqrt(dx * dx + dy * dy) || 1;
	// Arco más pronunciado para que se vea como "sobrevuela" el terreno
	const offset = dist * 0.55;
	const perpLng = (-dy / dist) * offset;
	const perpLat = (dx / dist) * offset;
	const control: [number, number] = [midLng + perpLng, midLat + perpLat];

	const points: [number, number][] = [];
	for (let i = 0; i <= segments; i++) {
		const t = i / segments;
		const oneMinusT = 1 - t;
		const lng =
			oneMinusT * oneMinusT * start[0] +
			2 * oneMinusT * t * control[0] +
			t * t * end[0];
		const lat =
			oneMinusT * oneMinusT * start[1] +
			2 * oneMinusT * t * control[1] +
			t * t * end[1];
		points.push([lng, lat]);
	}

	return {
		type: "Feature",
		properties: {},
		geometry: {
			type: "LineString",
			coordinates: points,
		},
	};
}

/** Crea un feature Point con rotación para la punta de flecha. */
export function createArrowHeadFeature(
	position: [number, number],
	bearing: number,
): GeoJSON.Feature<GeoJSON.Point> {
	return {
		type: "Feature",
		properties: { bearing },
		geometry: {
			type: "Point",
			coordinates: position,
		},
	};
}
