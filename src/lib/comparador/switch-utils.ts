import type { ModoRow } from "./comparador-types";

export type ModoState = {
	delta: number;
	locked: boolean;
};

export type RedistributeResult = ModoRow[];

export function redistributeBySliders(
	initial: ModoRow[],
	sliderState: Record<string, ModoState>,
	userAdjustedModes: Set<string>,
	totalOriginal: number,
): ModoRow[] {
	if (initial.length === 0) return [];
	if (totalOriginal === 0) return initial;

	const lockedSum = initial
		.filter((m) => sliderState[m.modo ?? ""]?.locked)
		.reduce((sum, m) => sum + m.porcentaje, 0);

	const adjustedModes = initial
		.filter((m) => userAdjustedModes.has(m.modo ?? ""))
		.map((m) => ({
			modo: m.modo ?? "",
			targetPct: sliderState[m.modo ?? ""]?.delta ?? 0,
		}));

	const adjustedSum = adjustedModes.reduce((sum, m) => sum + m.targetPct, 0);

	const freeModes = initial.filter((m) => !userAdjustedModes.has(m.modo ?? ""));
	const freeInitialSum = freeModes.reduce((sum, m) => sum + m.porcentaje, 0);

	const freeBudget = 100 - lockedSum - adjustedSum;

	const finalModes = initial.map((m) => {
		const modo = m.modo ?? "";
		const state = sliderState[modo];
		const locked = state?.locked ?? false;
		const isAdjusted = userAdjustedModes.has(modo);

		let targetPct: number;
		if (locked) {
			targetPct = m.porcentaje;
		} else if (isAdjusted) {
			targetPct = state?.delta ?? m.porcentaje;
		} else {
			const share =
				freeInitialSum > 0
					? m.porcentaje / freeInitialSum
					: freeModes.length > 0
						? 1 / freeModes.length
						: 0;
			targetPct = share * freeBudget;
		}

		const clampedPct = Math.max(0, Math.min(100, targetPct));
		const nViajes = Math.round((clampedPct / 100) * totalOriginal);
		const finalPct =
			totalOriginal > 0 ? Math.round((nViajes / totalOriginal) * 1000) / 10 : 0;

		return {
			...m,
			n_viajes: nViajes,
			porcentaje: finalPct,
		};
	});

	const sumCheck = finalModes.reduce((sum, m) => sum + m.n_viajes, 0);
	if (sumCheck !== totalOriginal && finalModes.length > 0) {
		const first = finalModes[0];
		const diff = totalOriginal - sumCheck;
		if (first && diff) {
			first.n_viajes = first.n_viajes + diff;
			const newPct = (first.n_viajes / totalOriginal) * 100;
			first.porcentaje = Math.round(newPct * 10) / 10;
		}
	}

	return finalModes;
}

export function getSliderRange(
	modo: string,
	initial: ModoRow[],
	sliderState: Record<string, ModoState>,
	userAdjustedModes: Set<string>,
): { min: number; max: number } {
	const found = initial.find((m) => m.modo === modo);
	if (!found) return { min: 0, max: 0 };

	const initialPct = found.porcentaje;
	const state = sliderState[modo];
	const locked = state?.locked ?? false;

	if (locked) return { min: initialPct, max: initialPct };

	const lockedSum = initial
		.filter((m) => sliderState[m.modo ?? ""]?.locked)
		.reduce((sum, m) => sum + m.porcentaje, 0);

	const otherAdjustedSum = initial
		.filter((m) => userAdjustedModes.has(m.modo ?? "") && m.modo !== modo)
		.reduce((sum, m) => {
			const s = sliderState[m.modo ?? ""];
			return sum + (s?.delta ?? m.porcentaje);
		}, 0);

	const freeInitialSum = initial
		.filter((m) => !userAdjustedModes.has(m.modo ?? ""))
		.reduce((sum, m) => (m.modo !== modo ? sum + m.porcentaje : sum), 0);

	const minFeasible = Math.max(0, initialPct - freeInitialSum);
	const maxFeasible = Math.min(100, 100 - lockedSum - otherAdjustedSum);

	return {
		min: Math.round(minFeasible * 10) / 10,
		max: Math.round(maxFeasible * 10) / 10,
	};
}

export function createInitialStatsMap(
	statsModo: ModoRow[],
): Map<string, number> {
	return new Map(statsModo.map((m) => [m.modo ?? "", m.porcentaje]));
}

export type { ModoRow };
