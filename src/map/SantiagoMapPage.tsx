import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { HoverInfo, InteractionMode } from "./types";
import { useSantiagoMap } from "./use-santiago-map";

export function SantiagoMapPage() {
	const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);
	const [mode, setMode] = useState<InteractionMode>("comunas");
	const modeRef = useRef<InteractionMode>("comunas");
	modeRef.current = mode;

	const { containerRef, clearPinned, resetView, applyModeVisibility } =
		useSantiagoMap(setHoverInfo, modeRef);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") clearPinned();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [clearPinned]);

	useEffect(() => {
		applyModeVisibility(mode);
	}, [mode, applyModeVisibility]);

	const changeMode = (nextMode: InteractionMode) => {
		modeRef.current = nextMode;
		setMode(nextMode);
		clearPinned();
		applyModeVisibility(nextMode);
		resetView();
	};

	return (
		<main className="relative h-[100svh] w-full overflow-hidden bg-[#edf4e8] text-[#102f37]">
			<div className="absolute inset-0 z-0">
				<div ref={containerRef} className="h-full w-full" />
			</div>

			<div className="absolute top-2 right-2 z-20 flex overflow-hidden rounded-full border border-white/70 bg-white/90 shadow-lg backdrop-blur-xl sm:top-4 sm:right-4">
				<button
					type="button"
					onClick={() => changeMode("comunas")}
					className={`px-3 py-1.5 text-xs font-bold transition ${
						mode === "comunas"
							? "bg-[#6f5bd5] text-white"
							: "text-[#5b777c] hover:bg-[#f1f7f4]"
					}`}
				>
					Comunas
				</button>
				<button
					type="button"
					onClick={() => changeMode("metro")}
					className={`px-3 py-1.5 text-xs font-bold transition ${
						mode === "metro"
							? "bg-[#0f8f98] text-white"
							: "text-[#5b777c] hover:bg-[#f1f7f4]"
					}`}
				>
					Metro
				</button>
			</div>

			<section className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex flex-col items-end gap-2 p-2 sm:pointer-events-auto sm:inset-y-0 sm:left-0 sm:right-auto sm:w-80 sm:items-start sm:overflow-y-auto sm:border-r sm:border-white/70 sm:bg-white/90 sm:p-4 sm:shadow-[4px_0_24px_rgba(16,47,55,0.1)] sm:backdrop-blur-xl">
				{hoverInfo?.pinned ? (
					<button
						type="button"
						onClick={() => {
							clearPinned();
							resetView();
						}}
						className="pointer-events-auto rounded-full border border-[#b9d7d1] bg-white/90 px-3 py-1.5 text-xs font-bold text-[#24525b] shadow-[0_8px_24px_rgba(16,47,55,0.18)] backdrop-blur transition hover:border-[#5bb6a6] hover:bg-white"
					>
						Alejar
					</button>
				) : null}

				<div className="pointer-events-auto w-full rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-[0_-12px_40px_rgba(16,47,55,0.16)] backdrop-blur-xl sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none sm:backdrop-blur-none">
					{hoverInfo ? (
						<div className="flex gap-3">
							<span
								className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
								style={{ backgroundColor: hoverInfo.accent }}
							/>
							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-2">
									<div className="min-w-0">
										<p className="m-0 text-[9px] font-black uppercase tracking-[0.18em] text-[#5b777c]">
											{hoverInfo.kind}
										</p>
										<p className="m-0 mt-0.5 truncate text-base font-black text-[#102f37]">
											{hoverInfo.title}
										</p>
									</div>
									<button
										type="button"
										onClick={clearPinned}
										className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-[10px] font-bold text-[#5b777c] transition hover:bg-[#eef4f1] hover:text-[#24525b]"
										aria-label="Cerrar"
									>
										✕
									</button>
								</div>
								{hoverInfo.details?.length ? (
									<div className="mt-2 flex flex-wrap gap-1">
										{hoverInfo.details.map((detail) => (
											<span
												key={detail}
												className="rounded-full bg-[#f1f7f4] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[#315a61]"
											>
												{detail}
											</span>
										))}
									</div>
								) : null}
							</div>
						</div>
					) : (
						<p className="m-0 text-center text-xs font-medium text-[#5b777c]">
							{mode === "comunas"
								? "Selecciona una comuna"
								: "Selecciona una estación de metro"}
						</p>
					)}
				</div>
			</section>
		</main>
	);
}
