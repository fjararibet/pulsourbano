import { describe, expect, it } from "vitest";
import {
	calculateQuickSimulation,
	calculateQuickSimulationRanges,
	type QuickSimulationInput,
} from "./quick-simulation";

const baseInput: QuickSimulationInput = {
	affectedTrips: 20_000,
	shiftToCarPct: 25,
	avgCarDistanceKm: 8,
	carOccupancy: 1.25,
	emissionKgCo2PerKm: 0.2,
	annualDays: 250,
	direction: "closure",
};

describe("calculateQuickSimulation", () => {
	it("returns positive impacts for a Metro closure", () => {
		const result = calculateQuickSimulation(baseInput);

		expect(result.changedPersonTrips).toBe(5_000);
		expect(result.carTrips).toBe(4_000);
		expect(result.vehicleKmPerDay).toBe(32_000);
		expect(result.kgCo2PerDay).toBe(6_400);
		expect(result.tonCo2PerYear).toBe(1_600);
	});

	it("returns avoided impacts for a Metro opening", () => {
		const result = calculateQuickSimulation({
			...baseInput,
			direction: "opening",
		});

		expect(result.sign).toBe(-1);
		expect(result.carTrips).toBe(-4_000);
		expect(result.kgCo2PerDay).toBe(-6_400);
	});

	it("does not break when occupancy is zero", () => {
		const result = calculateQuickSimulation({
			...baseInput,
			carOccupancy: 0,
		});

		expect(result.carTrips).toBe(0);
		expect(result.vehicleKmPerDay).toBe(0);
		expect(result.kgCo2PerDay).toBe(0);
	});
});

describe("calculateQuickSimulationRanges", () => {
	it("calculates low, medium and high scenarios", () => {
		const ranges = calculateQuickSimulationRanges(baseInput);

		expect(ranges.map((range) => range.id)).toEqual(["low", "medium", "high"]);
		expect(ranges.map((range) => range.shiftToCarPct)).toEqual([10, 25, 40]);
		expect(ranges[0]?.result.kgCo2PerDay).toBeLessThan(
			ranges[1]?.result.kgCo2PerDay ?? 0,
		);
		expect(ranges[1]?.result.kgCo2PerDay).toBeLessThan(
			ranges[2]?.result.kgCo2PerDay ?? 0,
		);
	});
});
