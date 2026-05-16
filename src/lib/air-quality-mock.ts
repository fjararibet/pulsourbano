import type { Station } from "./air-quality-types";

export const mockStations: Station[] = [
	{
		id: "las-condes",
		name: "Las Condes",
		latitude: -33.4089,
		longitude: -70.572,
		pm25: { value: 28, unit: "µg/m³" },
		ozone: { value: 45, unit: "µg/m³" },
		nitrogen: { value: 32, unit: "µg/m³" },
		carbon: { value: 0.8, unit: "mg/m³" },
		aqi: { value: 85, unit: "AQI" },
		lastUpdated: new Date().toISOString(),
	},
	{
		id: "el-bosque",
		name: "El Bosque",
		latitude: -33.551,
		longitude: -70.674,
		pm25: { value: 62, unit: "µg/m³" },
		ozone: { value: 38, unit: "µg/m³" },
		nitrogen: { value: 58, unit: "µg/m³" },
		carbon: { value: 1.4, unit: "mg/m³" },
		aqi: { value: 142, unit: "AQI" },
		lastUpdated: new Date().toISOString(),
	},
	{
		id: "independencia",
		name: "Independencia",
		latitude: -33.418,
		longitude: -70.654,
		pm25: { value: 45, unit: "µg/m³" },
		ozone: { value: 52, unit: "µg/m³" },
		nitrogen: { value: 41, unit: "µg/m³" },
		carbon: { value: 1.1, unit: "mg/m³" },
		aqi: { value: 110, unit: "AQI" },
		lastUpdated: new Date().toISOString(),
	},
	{
		id: "pudahuel",
		name: "Pudahuel",
		latitude: -33.444,
		longitude: -70.782,
		pm25: { value: 78, unit: "µg/m³" },
		ozone: { value: 35, unit: "µg/m³" },
		nitrogen: { value: 68, unit: "µg/m³" },
		carbon: { value: 1.9, unit: "mg/m³" },
		aqi: { value: 165, unit: "AQI" },
		lastUpdated: new Date().toISOString(),
	},
	{
		id: "la-florida",
		name: "La Florida",
		latitude: -33.522,
		longitude: -70.593,
		pm25: { value: 35, unit: "µg/m³" },
		ozone: { value: 48, unit: "µg/m³" },
		nitrogen: { value: 36, unit: "µg/m³" },
		carbon: { value: 0.9, unit: "mg/m³" },
		aqi: { value: 92, unit: "AQI" },
		lastUpdated: new Date().toISOString(),
	},
	{
		id: "cerro-navia",
		name: "Cerro Navia",
		latitude: -33.418,
		longitude: -70.735,
		pm25: { value: 55, unit: "µg/m³" },
		ozone: { value: 42, unit: "µg/m³" },
		nitrogen: { value: 47, unit: "µg/m³" },
		carbon: { value: 1.3, unit: "mg/m³" },
		aqi: { value: 128, unit: "AQI" },
		lastUpdated: new Date().toISOString(),
	},
];

// Synthetic heatmap points for Deck.gl (PM2.5 field)
// Distributed across Santiago metro with realistic concentration patterns
export function generateHeatmapPoints(): {
	longitude: number;
	latitude: number;
	pm25: number;
}[] {
	const points: { longitude: number; latitude: number; pm25: number }[] = [];

	// Base grid across the metro area
	for (let lat = -33.65; lat <= -33.25; lat += 0.015) {
		for (let lng = -70.85; lng <= -70.45; lng += 0.015) {
			// Distance from city center (approx -33.45, -70.65)
			const distCenter = Math.sqrt(
				Math.pow(lat + 33.45, 2) + Math.pow(lng + 70.65, 2),
			);

			// Industrial/western areas (Pudahuel, Quinta Normal) tend to be worse
			const westBias = lng < -70.7 ? 1.4 : 1.0;

			// Base PM2.5 increases toward center and west
			let pm25 = 30 + distCenter * 150 * westBias;

			// Add some noise
			pm25 += (Math.random() - 0.5) * 20;

			// Clamp realistic range
			pm25 = Math.max(10, Math.min(180, pm25));

			points.push({ latitude: lat, longitude: lng, pm25 });
		}
	}

	return points;
}
