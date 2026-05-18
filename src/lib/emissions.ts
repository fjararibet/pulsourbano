import type { ModoRow } from "#/lib/comparador/comparador-types";

export function calculateCO2Kg(
	distanceKm: number,
	vehicleCount: number,
): number {
	const KM_PER_LITER = 15;
	const CO2_PER_LITER = 2.67;

	const litersUsed = distanceKm / KM_PER_LITER;

	return litersUsed * CO2_PER_LITER * vehicleCount;
}

export function calculatePM25Grams(
	distanceKm: number,
	vehicleCount: number,
): number {
	const PM25_GRAMS_PER_KM = 0.005;

	return distanceKm * vehicleCount * PM25_GRAMS_PER_KM;
}

export function calculateAQI(pm25Concentration: number): number {
	if (pm25Concentration <= 12) {
		return (50 / 12) * pm25Concentration;
	}

	if (pm25Concentration <= 35.4) {
		return 50 + ((100 - 50) / (35.4 - 12.1)) * (pm25Concentration - 12.1);
	}

	if (pm25Concentration <= 55.4) {
		return 101 + ((150 - 101) / (55.4 - 35.5)) * (pm25Concentration - 35.5);
	}

	if (pm25Concentration <= 150.4) {
		return 151 + ((200 - 151) / (150.4 - 55.5)) * (pm25Concentration - 55.5);
	}

	return 300;
}

export const VEHICLE_OCCUPANCY = {
	Auto: 1,
	Bus: 30,
} as const;

export const POLLUTING_MODES = ["Auto", "Bus"] as const satisfies ReadonlyArray<
	keyof typeof VEHICLE_OCCUPANCY
>;

export type EmissionTotals = {
	co2Kg: number;
	pm25Grams: number;
	aqi: number;
};

export function computeEmissions(
	stats: ModoRow[],
	percentByMode: number[],
	routeModes: ReadonlyArray<{ statsKey: string }>,
	totalTrips: number,
): EmissionTotals {
	let co2Kg = 0;
	let pm25Grams = 0;

	if (totalTrips > 0) {
		for (let i = 0; i < routeModes.length; i++) {
			const route = routeModes[i];
			if (!route) continue;
			const key = route.statsKey as (typeof POLLUTING_MODES)[number];
			if (!(POLLUTING_MODES as readonly string[]).includes(key)) continue;
			const occupancy = VEHICLE_OCCUPANCY[key];
			const stat = stats.find((s) => s.modo === key);
			if (!stat) continue;
			const pct = percentByMode[i] ?? 0;
			const simulatedTrips = (pct / 100) * totalTrips;
			const vehicleCount = simulatedTrips / occupancy;
			const distanceKm = stat.distancia_promedio_km;
			co2Kg += calculateCO2Kg(distanceKm, vehicleCount);
			pm25Grams += calculatePM25Grams(distanceKm, vehicleCount);
		}
	}

	return {
		co2Kg,
		pm25Grams,
		aqi: calculateAQI(pm25Grams),
	};
}
