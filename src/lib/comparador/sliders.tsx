import { useState } from "react";

const labels = ["A", "B", "C", "D"];

interface PercentageSlidersProps {
	initialValues?: number[];
}

export default function PercentageSliders({
	initialValues,
}: PercentageSlidersProps) {
	const [values, setValues] = useState<number[]>(
		initialValues || [25, 25, 25, 25],
	);

	const updateSlider = (index: number, newValue: number) => {
		const next = [...values];
		const oldValue = next[index] ?? 0;

		const diff = newValue - oldValue;
		next[index] = newValue;

		const otherIndexes = next.map((_, i) => i).filter((i) => i !== index);

		const totalOthers = otherIndexes.reduce(
			(sum, i) => sum + (next[i] ?? 0),
			0,
		);

		if (totalOthers > 0) {
			for (const i of otherIndexes) {
				const current = next[i] ?? 0;
				const proportion = current / totalOthers;

				next[i] = current - diff * proportion;
			}
		}

		for (let i = 0; i < next.length; i++) {
			next[i] = Math.max(0, Math.round(next[i] ?? 0));
		}

		const total = next.reduce((a, b) => a + b, 0);
		const correction = 100 - total;

		const firstOther = otherIndexes[0];

		if (firstOther !== undefined) {
			next[firstOther] = (next[firstOther] ?? 0) + correction;
		}

		setValues(next);
	};

	return (
		<div className="w-full max-w-md space-y-4 rounded-2xl border p-4">
			{values.map((value, index) => {
				const label = labels[index] ?? String(index);
				return (
					<div key={`slider-${label}`} className="space-y-1">
						<div className="flex justify-between text-sm">
							<span>{label}</span>
							<span>{value}%</span>
						</div>

						<input
							type="range"
							min={0}
							max={100}
							value={value}
							onChange={(e) => updateSlider(index, Number(e.target.value))}
							className="w-full"
						/>
					</div>
				);
			})}

			<div className="pt-2 text-right text-sm font-medium">
				Total: {values.reduce((a, b) => a + b, 0)}%
			</div>
		</div>
	);
}
