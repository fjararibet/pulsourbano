import { BUS_COLOR } from "./config";

/** Leyenda fija en la esquina inferior derecha (solo desktop). */
export function MapLegend() {
	return (
		<aside className="pointer-events-none absolute bottom-4 right-4 z-10 hidden rounded-3xl border border-white/70 bg-white/82 p-3 text-xs font-bold text-[#244b52] shadow-[0_18px_50px_rgba(16,47,55,0.16)] backdrop-blur-xl sm:block">
			<LegendRow color="#0f8f98" label="Metro" />
			<LegendRow color={BUS_COLOR} label="Micros RED" />
			<LegendRow color="#f2a900" label="Paraderos RED" dot />
			<LegendRow color="#10a56f" label="Ciclovías" dashed />
			<LegendRow color="#102f37" label="Estaciones" dot />
		</aside>
	);
}

function LegendRow({
	color,
	label,
	dashed = false,
	dot = false,
}: {
	color: string;
	label: string;
	dashed?: boolean;
	dot?: boolean;
}) {
	return (
		<div className="flex items-center gap-2 py-1">
			<span
				className={dot ? "h-2.5 w-2.5 rounded-full" : "h-1 w-8 rounded-full"}
				style={
					dashed
						? {
								backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 8px)`,
							}
						: { backgroundColor: color }
				}
			/>
			<span>{label}</span>
		</div>
	);
}
