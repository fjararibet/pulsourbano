import { COMUNA_COLOR } from "./config";

/** Leyenda fija en la esquina inferior derecha (solo desktop). */
export function MapLegend({ showNoiseOverlay }: { showNoiseOverlay: boolean }) {
	if (showNoiseOverlay) return null;

	return (
		<aside className="pointer-events-none absolute bottom-4 right-4 z-10 hidden rounded-3xl border border-white/70 bg-white/82 p-3 text-xs font-bold text-[#244b52] shadow-[0_18px_50px_rgba(16,47,55,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-[#08141c]/88 dark:text-[#d8f6ff] dark:shadow-[0_18px_50px_rgba(0,0,0,0.38)] sm:block">
			<LegendRow color={COMUNA_COLOR} label="Comunas RM" />
		</aside>
	);
}

function LegendRow({
	color,
	label,
	dot = false,
}: {
	color: string;
	label: string;
	dot?: boolean;
}) {
	return (
		<div className="flex items-center gap-2 py-0.5">
			<span
				className={
					dot
						? "h-2.5 w-2.5 shrink-0 rounded-full"
						: "h-1 w-8 shrink-0 rounded-full"
				}
				style={{ backgroundColor: color }}
			/>
			<span>{label}</span>
		</div>
	);
}
