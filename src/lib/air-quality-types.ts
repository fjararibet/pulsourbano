export interface AirQualityReading {
	value: number;
	unit: string;
}

export interface Station {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	pm25: AirQualityReading; // µg/m³
	ozone: AirQualityReading; // µg/m³
	nitrogen: AirQualityReading; // µg/m³ (NO₂)
	carbon: AirQualityReading; // µg/m³ (CO)
	aqi: AirQualityReading; // 0-500 scale
	lastUpdated: string; // ISO timestamp
}

export type AqiLevel =
	| "good"
	| "moderate"
	| "unhealthy-sensitive"
	| "unhealthy"
	| "very-unhealthy";

export function getAqiLevel(aqi: number): AqiLevel {
	if (aqi <= 50) return "good";
	if (aqi <= 100) return "moderate";
	if (aqi <= 150) return "unhealthy-sensitive";
	if (aqi <= 200) return "unhealthy";
	return "very-unhealthy";
}

export function getAqiColor(aqi: number): string {
	const level = getAqiLevel(aqi);
	switch (level) {
		case "good":
			return "#22C55E";
		case "moderate":
			return "#EAB308";
		case "unhealthy-sensitive":
			return "#F97316";
		case "unhealthy":
			return "#EF4444";
		case "very-unhealthy":
			return "#7C3AED";
	}
}

export function getAqiLabel(aqi: number): string {
	const level = getAqiLevel(aqi);
	switch (level) {
		case "good":
			return "Bueno";
		case "moderate":
			return "Moderado";
		case "unhealthy-sensitive":
			return "Dañino para grupos sensibles";
		case "unhealthy":
			return "Dañino";
		case "very-unhealthy":
			return "Muy dañino";
	}
}
