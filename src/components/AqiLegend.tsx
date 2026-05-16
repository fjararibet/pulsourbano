import { getAqiColor } from "#/lib/air-quality-types";

interface AqiLegendProps {
	showStations: boolean;
	onToggleStations: () => void;
}

const LEVELS = [
	{ min: 0, max: 50, label: "Bueno" },
	{ min: 51, max: 100, label: "Moderado" },
	{ min: 101, max: 150, label: "Sensibles" },
	{ min: 151, max: 200, label: "Dañino" },
	{ min: 201, max: 300, label: "Muy dañino" },
	{ min: 301, max: 500, label: "Peligroso" },
];

export default function AqiLegend({
	showStations,
	onToggleStations,
}: AqiLegendProps) {
	return (
		<div className="pointer-events-auto absolute bottom-5 left-5 z-20 flex flex-col gap-2">
			<div className="rounded-xl border border-white/15 bg-black/35 px-4 py-3 shadow-lg backdrop-blur-md">
				<div className="mb-2 flex items-center justify-between gap-4">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
						Calidad del Aire
					</p>
					<button
						onClick={onToggleStations}
						className="rounded-md bg-white/15 px-2 py-1 text-[10px] font-semibold text-white/90 transition hover:bg-white/25"
						type="button"
					>
						Estaciones {showStations ? "ON" : "OFF"}
					</button>
				</div>
				<div className="flex h-2 overflow-hidden rounded-full">
					{LEVELS.map((level) => (
						<div
							key={level.label}
							className="flex-1"
							style={{
								backgroundColor: getAqiColor((level.min + level.max) / 2),
							}}
						/>
					))}
				</div>
				<div className="mt-1.5 flex justify-between">
					{LEVELS.map((level) => (
						<div key={level.label} className="flex-1 text-center">
							<span className="block text-[9px] font-bold text-white/90">
								{level.min}–{level.max}
							</span>
							<span className="block text-[9px] text-white/70">
								{level.label}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
