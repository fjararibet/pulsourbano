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

			<section className="pointer-events-none absolute left-3 top-3 z-10 w-[min(360px,calc(100vw-24px))] sm:left-5 sm:top-5">
				<div className="pointer-events-auto max-h-[calc(100svh-24px)] overflow-y-auto overscroll-contain rounded-[28px] border border-white/70 bg-white/82 p-4 shadow-[0_24px_70px_rgba(16,47,55,0.18)] backdrop-blur-xl sm:max-h-[calc(100svh-40px)] sm:p-5">
					<header className="mb-4 flex items-start justify-between gap-3">
						<div>
							<p className="m-0 text-[10px] font-black uppercase tracking-[0.22em] text-[#168a76]">
								Mapa de movilidad
							</p>
							<h1 className="m-0 mt-1 text-2xl font-black tracking-[-0.04em] text-[#102f37]">
								SimSantiago
							</h1>
						</div>
						<button
							type="button"
							onClick={resetView}
							className="rounded-full border border-[#b9d7d1] bg-white/80 px-3 py-1.5 text-xs font-bold text-[#24525b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#5bb6a6] hover:bg-white"
						>
							Reset vista
						</button>
					</header>

					<p className="mb-4 text-sm leading-5 text-[#42656b]">
						Selecciona una comuna para ver sus detalles.
					</p>

					<div className="mt-4 rounded-2xl border border-[#d9e7e4] bg-white/72 p-3">
						{hoverInfo ? (
							<div className="flex gap-3">
								<span
									className="mt-1 h-3 w-3 shrink-0 rounded-full"
									style={{ backgroundColor: hoverInfo.accent }}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<div>
											<p className="m-0 text-[10px] font-black uppercase tracking-[0.2em] text-[#5b777c]">
												{hoverInfo.kind}
											</p>
											<p className="m-0 mt-0.5 text-sm font-black text-[#102f37]">
												{hoverInfo.title}
											</p>
											<p className="m-0 mt-1 break-words text-xs leading-4 text-[#5b777c]">
												{hoverInfo.description}
											</p>
										</div>
										<button
											type="button"
											onClick={clearPinned}
											className="ml-2 shrink-0 rounded-full border border-[#c2d5d8] bg-white/80 p-1.5 text-[10px] font-bold text-[#24525b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#5bb6a6] hover:bg-white"
											aria-label="Cerrar"
										>
											✕
										</button>
									</div>
									{hoverInfo.details?.length ? (
										<div className="mt-2 grid gap-1.5">
											{hoverInfo.details.map((detail) => (
												<p
													key={detail}
													className="m-0 rounded-xl bg-[#f5faf7] px-2.5 py-1.5 text-xs font-semibold leading-4 break-words text-[#315a61]"
												>
													{detail}
												</p>
											))}
										</div>
									) : null}
								</div>
							</div>
						) : (
							<p className="m-0 text-xs leading-4 text-[#5b777c]">
								Sin selección
							</p>
						)}
					</div>
				</div>
			</section>
		</main>
	);
}
