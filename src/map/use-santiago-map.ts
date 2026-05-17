import type { Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";
import {
	BASE_STYLE,
	COMUNA_ZOOM,
	INITIAL_ZOOM,
	SANTIAGO_CENTER,
} from "./config";
import { type HoverPinController, setupComunaHover } from "./hover";
import { addComunaLayers, bringComunaHoverToFront } from "./layers";
import type { HoverInfo } from "./types";
import { loadGeoJSON } from "./utils";

/**
 * Inicializa MapLibre, carga los GeoJSON de Metro/Buses/Ciclovías, monta las
 * capas y conecta los handlers de hover. Devuelve el ref del contenedor y
 * un helper para resetear la vista.
 */
export function useSantiagoMap(setHoverInfo: (info: HoverInfo) => void) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const pinnedInfoRef = useRef<HoverInfo>(null);
	const clearPinnedEffectsRef = useRef<(() => void) | null>(null);

	const clearPinned = useCallback(() => {
		clearPinnedEffectsRef.current?.();
		clearPinnedEffectsRef.current = null;
		pinnedInfoRef.current = null;
		setHoverInfo(null);
	}, [setHoverInfo]);

	useEffect(() => {
		let cancelled = false;
		let cleanup: (() => void) | undefined;
		const pinController: HoverPinController = {
			isPinned: () => pinnedInfoRef.current !== null,
			pin: (info, clearEffects) => {
				clearPinnedEffectsRef.current?.();
				const pinnedInfo = { ...info, pinned: true };
				pinnedInfoRef.current = pinnedInfo;
				clearPinnedEffectsRef.current = clearEffects ?? null;
				setHoverInfo(pinnedInfo);
			},
		};

		(async () => {
			if (!containerRef.current) return;
			const maplibregl = await import("maplibre-gl");
			if (cancelled || !containerRef.current) return;

			const map = new maplibregl.Map({
				container: containerRef.current,
				// biome-ignore lint/suspicious/noExplicitAny: MapLibre tiene tipos de style muy estrictos para objetos inline.
				style: structuredClone(BASE_STYLE) as any,
				center: SANTIAGO_CENTER,
				zoom: INITIAL_ZOOM,
				attributionControl: { compact: true },
				dragPan: false,
				scrollZoom: false,
				doubleClickZoom: false,
				touchZoomRotate: false,
				dragRotate: false,
				keyboard: false,
			});
			mapRef.current = map;

			map.on("error", (event) => {
				console.error("MapLibre error", event.error ?? event);
			});

			// Exponer el mapa al window en dev para debug desde la consola.
			let debugWindow: (typeof window & { __simMap?: MapLibreMap }) | undefined;
			if (import.meta.env.DEV) {
				debugWindow = window as typeof window & { __simMap?: MapLibreMap };
				debugWindow.__simMap = map;
			}

			// Resize defensivo: en algunos layouts (mobile, tabs) el contenedor
			// arranca con tamaño 0 y MapLibre lo deja en blanco si no le decimos.
			const resize = () => map.resize();
			const ro = new ResizeObserver(resize);
			if (containerRef.current) ro.observe(containerRef.current);
			requestAnimationFrame(resize);
			setTimeout(resize, 120);

			const hoverCleanup: Array<() => void> = [];

			cleanup = () => {
				pinnedInfoRef.current = null;
				clearPinnedEffectsRef.current = null;
				for (const fn of hoverCleanup) fn();
				if (debugWindow?.__simMap === map) delete debugWindow.__simMap;
				ro.disconnect();
				map.remove();
			};

			map.on("load", async () => {
				resize();
				const comunas = await loadGeoJSON("/data/comunas_rm.geojson");

				if (comunas) addComunaLayers(map, comunas);
				if (comunas) bringComunaHoverToFront(map);

				map.setCenter(SANTIAGO_CENTER);
				map.setZoom(INITIAL_ZOOM);

				if (comunas) {
					hoverCleanup.push(
						setupComunaHover(map, setHoverInfo, pinController, COMUNA_ZOOM),
					);
				}
			});
		})();

		return () => {
			cancelled = true;
			cleanup?.();
			mapRef.current = null;
		};
	}, [setHoverInfo]);

	const resetView = () => {
		mapRef.current?.easeTo({
			center: SANTIAGO_CENTER,
			zoom: INITIAL_ZOOM,
			bearing: 0,
			pitch: 0,
			duration: 200,
		});
	};

	return { containerRef, clearPinned, resetView };
}
