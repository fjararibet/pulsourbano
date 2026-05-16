import { getAqiColor, getAqiLabel } from "#/lib/air-quality-types";
import type { Station } from "#/lib/air-quality-types";

interface StationCardProps {
	station: Station;
	onFlyTo: (station: Station) => void;
}

export default function StationCard({ station, onFlyTo }: StationCardProps) {
	const aqiColor = getAqiColor(station.aqi.value);
	const aqiLabel = getAqiLabel(station.aqi.value);

	const metrics = [
		{ label: "PM2.5", value: `${station.pm25.value} ${station.pm25.unit}` },
		{ label: "Ozono", value: `${station.ozone.value} ${station.ozone.unit}` },
		{
			label: "Nitrógeno",
			value: `${station.nitrogen.value} ${station.nitrogen.unit}`,
		},
		{
			label: "Carbono",
			value: `${station.carbon.value} ${station.carbon.unit}`,
		},
		{ label: "AQI", value: `${station.aqi.value}` },
	];

	return (
		<div className="rounded-xl border border-(--line) bg-(--chip-bg) p-4 shadow-sm transition hover:shadow-md">
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-base font-bold text-(--sea-ink)">{station.name}</h3>
				<span
					className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
					style={{ backgroundColor: aqiColor }}
				>
					{aqiLabel}
				</span>
			</div>

			<div className="mb-3 grid grid-cols-3 gap-2">
				{metrics.map((m) => (
					<div key={m.label} className="text-center">
						<p className="text-xs text-(--sea-ink-soft)">{m.label}</p>
						<p className="text-sm font-semibold text-(--sea-ink)">{m.value}</p>
					</div>
				))}
			</div>

			<div className="flex items-center justify-between">
				<p className="text-xs text-(--sea-ink-soft)">
					Actualizado:{" "}
					{new Date(station.lastUpdated).toLocaleTimeString("es-CL", {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</p>
				<button
					onClick={() => onFlyTo(station)}
					className="rounded-lg bg-(--lagoon) px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-(--lagoon-deep)"
					type="button"
				>
					Ver en mapa
				</button>
			</div>
		</div>
	);
}
