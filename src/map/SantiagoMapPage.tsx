import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useState } from "react";
import type { HoverInfo } from "./types";
import { useSantiagoMap } from "./use-santiago-map";

export function SantiagoMapPage() {
	const [hoverInfo, setHoverInfo] = useState<HoverInfo>(null);
	const { containerRef, clearPinned, resetView } = useSantiagoMap(setHoverInfo);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") clearPinned();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [clearPinned]);

	return (
		<main className="relative h-[100svh] w-full overflow-hidden bg-[#edf4e8] text-[#102f37]">
			<div className="absolute inset-0 z-0">
				<div ref={containerRef} className="h-full w-full" />
			</div>

			<section className="pointer-events-none absolute left-2 top-2 z-10 w-[min(320px,calc(100vw-16px))] sm:left-5 sm:top-5 sm:w-[min(340px,calc(100vw-40px))]">
				<div className="pointer-events-auto max-h-[calc(100svh-16px)] overflow-y-auto overscroll-contain rounded-2xl border border-white/70 bg-white/85 px-3 py-2.5 shadow-[0_12px_40px_rgba(16,47,55,0.16)] backdrop-blur-xl sm:max-h-[calc(100svh-40px)] sm:px-4 sm:py-3">
					{hoverInfo ? (
						<div className="flex gap-2.5">
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
										<p className="m-0 mt-0.5 truncate text-sm font-black text-[#102f37]">
											{hoverInfo.title}
										</p>
									</div>
									<div className="-mr-1 -mt-1 flex shrink-0 items-center gap-1">
										<button
											type="button"
											onClick={resetView}
											className="rounded-full border border-[#b9d7d1] bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#24525b] transition hover:border-[#5bb6a6] hover:bg-white"
										>
											Volver
										</button>
										<button
											type="button"
											onClick={clearPinned}
											className="rounded-full p-1.5 text-[10px] font-bold text-[#5b777c] transition hover:bg-[#eef4f1] hover:text-[#24525b]"
											aria-label="Cerrar"
										>
											✕
										</button>
									</div>
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
						<div className="flex items-center justify-between gap-2">
							<p className="m-0 text-xs font-medium text-[#5b777c]">
								Selecciona una comuna
							</p>
							<button
								type="button"
								onClick={resetView}
								className="shrink-0 rounded-full border border-[#b9d7d1] bg-white/80 px-2.5 py-1 text-[11px] font-bold text-[#24525b] transition hover:border-[#5bb6a6] hover:bg-white"
							>
								Volver
							</button>
						</div>
					)}
				</div>
			</section>
		</main>
	);
}
