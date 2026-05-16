import { useState } from "react";
import StationCard from "./StationCard";
import { mockStations } from "#/lib/air-quality-mock";
import type { Station } from "#/lib/air-quality-types";

interface AirQualityPanelProps {
	isOpen: boolean;
	onClose: () => void;
	onFlyTo: (station: Station) => void;
}

export default function AirQualityPanel({
	isOpen,
	onClose,
	onFlyTo,
}: AirQualityPanelProps) {
	const [selectedStationId, setSelectedStationId] = useState<string | null>(
		null,
	);

	const selectedStation = selectedStationId
		? mockStations.find((s) => s.id === selectedStationId) || null
		: null;

	return (
		<>
			{/* Desktop side panel */}
			<div
				className={`fixed right-0 top-14 z-40 hidden h-[calc(100dvh-3.5rem)] w-96 transform border-l border-(--line) bg-(--surface-strong) backdrop-blur-lg transition-transform duration-300 ease-out md:block ${
					isOpen ? "translate-x-0" : "translate-x-full"
				}`}
			>
				<div className="flex h-full flex-col">
					<div className="flex items-center justify-between border-b border-(--line) px-5 py-4">
						<h2 className="text-lg font-bold text-(--sea-ink)">
							Calidad del Aire — Santiago
						</h2>
						<button
							onClick={onClose}
							className="rounded-lg p-2 text-(--sea-ink-soft) transition hover:bg-(--link-bg-hover) hover:text-(--sea-ink)"
							aria-label="Cerrar panel"
							type="button"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								className="size-5"
								aria-hidden="true"
							>
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div className="flex-1 overflow-y-auto p-4">
						{selectedStation ? (
							<div className="space-y-4">
								<button
									onClick={() => setSelectedStationId(null)}
									className="flex items-center gap-1 text-sm font-semibold text-(--lagoon-deep) transition hover:text-(--sea-ink)"
									type="button"
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="size-4"
										aria-hidden="true"
									>
										<path d="m15 18-6-6 6-6" />
									</svg>
									Volver a estaciones
								</button>
								<StationCard station={selectedStation} onFlyTo={onFlyTo} />
							</div>
						) : (
							<div className="space-y-3">
								{mockStations.map((station) => (
									<button
										key={station.id}
										onClick={() => setSelectedStationId(station.id)}
										className="w-full text-left"
										type="button"
									>
										<StationCard
											station={station}
											onFlyTo={(s) => {
												onFlyTo(s);
												setSelectedStationId(s.id);
											}}
										/>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Mobile bottom sheet */}
			<div
				className={`fixed inset-x-0 bottom-0 z-40 transform rounded-t-2xl border-t border-(--line) bg-(--surface-strong) backdrop-blur-lg transition-transform duration-300 ease-out md:hidden ${
					isOpen ? "translate-y-0" : "translate-y-full"
				}`}
				style={{ height: "65vh" }}
			>
				<div className="flex h-full flex-col">
					<div className="flex items-center justify-center py-2">
						<div className="h-1.5 w-10 rounded-full bg-(--line)" />
					</div>
					<div className="flex items-center justify-between border-b border-(--line) px-5 py-3">
						<h2 className="text-lg font-bold text-(--sea-ink)">
							Calidad del Aire
						</h2>
						<button
							onClick={onClose}
							className="rounded-lg p-2 text-(--sea-ink-soft) transition hover:bg-(--link-bg-hover) hover:text-(--sea-ink)"
							aria-label="Cerrar panel"
							type="button"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								className="size-5"
								aria-hidden="true"
							>
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					</div>

					<div className="flex-1 overflow-y-auto p-4">
						{selectedStation ? (
							<div className="space-y-4">
								<button
									onClick={() => setSelectedStationId(null)}
									className="flex items-center gap-1 text-sm font-semibold text-(--lagoon-deep) transition hover:text-(--sea-ink)"
									type="button"
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										className="size-4"
										aria-hidden="true"
									>
										<path d="m15 18-6-6 6-6" />
									</svg>
									Volver a estaciones
								</button>
								<StationCard station={selectedStation} onFlyTo={onFlyTo} />
							</div>
						) : (
							<div className="space-y-3">
								{mockStations.map((station) => (
									<button
										key={station.id}
										onClick={() => setSelectedStationId(station.id)}
										className="w-full text-left"
										type="button"
									>
										<StationCard
											station={station}
											onFlyTo={(s) => {
												onFlyTo(s);
												setSelectedStationId(s.id);
											}}
										/>
									</button>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
