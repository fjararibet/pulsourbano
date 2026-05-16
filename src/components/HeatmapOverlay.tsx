import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { generateHeatmapPoints } from "#/lib/air-quality-mock";

interface HeatmapOverlayProps {
	longitude: number;
	latitude: number;
	zoom: number;
}

export default function HeatmapOverlay({
	longitude,
	latitude,
	zoom,
}: HeatmapOverlayProps) {
	const data = useMemo(() => generateHeatmapPoints(), []);

	const layers = [
		new HeatmapLayer({
			id: "pm25-heatmap",
			data,
			getPosition: (d: any) => [d.longitude, d.latitude],
			getWeight: (d: any) => d.pm25,
			radiusPixels: 40,
			intensity: 1.2,
			threshold: 0.05,
			colorRange: [
				[34, 197, 94], // green (low)
				[234, 179, 8], // yellow
				[249, 115, 22], // orange
				[239, 68, 68], // red
				[124, 58, 237], // purple
				[124, 58, 237], // purple (very high)
			],
			opacity: 0.35,
		}),
	];

	return (
		<DeckGL
			viewState={{ longitude, latitude, zoom } as any}
			layers={layers}
			controller={false}
			style={
				{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					pointerEvents: "none",
				} as any
			}
			getTooltip={({ object }: any) =>
				object && object.points
					? `PM2.5: ${Math.round(object.value)} µg/m³`
					: null
			}
		/>
	);
}
