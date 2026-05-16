export type ScenarioDirection = "closure" | "opening";

export type QuickSimulationInput = {
	affectedTrips: number;
	shiftToCarPct: number;
	avgCarDistanceKm: number;
	carOccupancy: number;
	emissionKgCo2PerKm: number;
	annualDays: number;
	direction: ScenarioDirection;
};

export type QuickSimulationResult = {
	direction: ScenarioDirection;
	sign: 1 | -1;
	changedPersonTrips: number;
	carTrips: number;
	vehicleKmPerDay: number;
	kgCo2PerDay: number;
	tonCo2PerYear: number;
};

export type QuickSimulationRange = {
	id: "low" | "medium" | "high";
	label: string;
	shiftToCarPct: number;
	result: QuickSimulationResult;
};

export const DEFAULT_QUICK_SIMULATION_INPUT: QuickSimulationInput = {
	affectedTrips: 20_000,
	shiftToCarPct: 25,
	avgCarDistanceKm: 8,
	carOccupancy: 1.3,
	emissionKgCo2PerKm: 0.2,
	annualDays: 250,
	direction: "closure",
};

export const QUICK_SIMULATION_RANGES = [
	{ id: "low", label: "Bajo", shiftToCarPct: 10 },
	{ id: "medium", label: "Medio", shiftToCarPct: 25 },
	{ id: "high", label: "Alto", shiftToCarPct: 40 },
] as const;

export function calculateQuickSimulation(
	input: QuickSimulationInput,
): QuickSimulationResult {
	const affectedTrips = sanitizePositive(input.affectedTrips);
	const shiftToCarPct = clamp(sanitizePositive(input.shiftToCarPct), 0, 100);
	const avgCarDistanceKm = sanitizePositive(input.avgCarDistanceKm);
	const carOccupancy = sanitizePositive(input.carOccupancy);
	const emissionKgCo2PerKm = sanitizePositive(input.emissionKgCo2PerKm);
	const annualDays = sanitizePositive(input.annualDays);
	const sign = input.direction === "opening" ? -1 : 1;
	const changedPersonTrips = affectedTrips * (shiftToCarPct / 100);
	const carTrips = carOccupancy > 0 ? changedPersonTrips / carOccupancy : 0;
	const vehicleKmPerDay = carTrips * avgCarDistanceKm;
	const kgCo2PerDay = vehicleKmPerDay * emissionKgCo2PerKm;
	const tonCo2PerYear = (kgCo2PerDay * annualDays) / 1_000;

	return {
		direction: input.direction,
		sign,
		changedPersonTrips: changedPersonTrips * sign,
		carTrips: carTrips * sign,
		vehicleKmPerDay: vehicleKmPerDay * sign,
		kgCo2PerDay: kgCo2PerDay * sign,
		tonCo2PerYear: tonCo2PerYear * sign,
	};
}

export function calculateQuickSimulationRanges(
	input: QuickSimulationInput,
): QuickSimulationRange[] {
	return QUICK_SIMULATION_RANGES.map((range) => ({
		...range,
		result: calculateQuickSimulation({
			...input,
			shiftToCarPct: range.shiftToCarPct,
		}),
	}));
}

function sanitizePositive(value: number) {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
