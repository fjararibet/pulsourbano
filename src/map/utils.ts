import type { MapGeoJSONFeature } from "maplibre-gl";
import type { FrequencyInfo } from "./types";

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
	const minutes = Math.max(1, Math.round(frequency.mean_headway_s / 60));
	return `Frecuencia media: cada ${minutes} min`;
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
