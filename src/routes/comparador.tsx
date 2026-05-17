import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import React from "react";
import { z } from "zod";
import type {
	ModoRow,
	PeriodoRow,
	PropositoRow,
	ResumenViaje,
	StatsRow,
	TiempoMedioRow,
} from "#/lib/comparador/comparador-types";
import {
	getSliderRange,
	redistributeBySliders,
} from "#/lib/comparador/redist";

// ── tipos ─────────────────────────────────────────────

type ComunaRow = {
	id: string;
	comuna: string;
};

// ── server functions ──────────────────────────────────

const getComunas = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const { results } = await env.EOD2012.prepare(
			`SELECT id, comuna FROM comuna ORDER BY comuna`,
		).all<ComunaRow>();
		return results;
	} catch (e) {
		console.error("[getComunas] DB error:", e);
		return [] as ComunaRow[];
	}
});

function validateOrigenDestino(data: unknown): {
	origen: string;
	destino: string;
} {
	if (typeof data !== "object" || data === null) {
		throw new Error("Invalid input");
	}
	const d = data as Record<string, unknown>;
	if (typeof d.origen !== "string" || typeof d.destino !== "string") {
		throw new Error("Missing fields");
	}
	return { origen: d.origen, destino: d.destino };
}

const getEstadisticasViajes = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<StatsRow[]> => {
		const query = `SELECT v.modoAgregado AS modo,
		        COUNT(*) AS n_viajes,
		        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje,
		        ROUND(AVG(d.distEuclidiana * 60.0 / v.tiempoViaje), 1) AS velocidad_promedio
		 FROM viaje v
		 LEFT JOIN distancia_viaje d ON d.viaje = v.viaje
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		   AND v.tiempoViaje > 0 AND d.distEuclidiana > 0
		 GROUP BY v.modoAgregado
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): { all(): Promise<{ results: StatsRow[] }> };
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

const getTotalViajes = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<number> => {
		const query = `SELECT COUNT(*) AS total
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 WHERE co.comuna = ?1 AND cd.comuna = ?2`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: Array<{ total: number }> }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results[0]?.total ?? 0;
		} catch {
			return 0;
		}
	});

const getResumenViaje = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<ResumenViaje> => {
		const query = `
		 WITH totals AS (
		   SELECT
		     COUNT(*) AS total_viajes,
		     ROUND(AVG(d.distEuclidiana), 2) AS distancia_promedio_km,
		     ROUND(AVG(v.tiempoViaje), 1) AS tiempo_promedio_min,
		     ROUND(AVG(d.distEuclidiana * 60.0 / v.tiempoViaje), 1) AS velocidad_promedio_kmh
		   FROM viaje v
		   LEFT JOIN distancia_viaje d ON d.viaje = v.viaje
		   LEFT JOIN comuna co ON co.id = v.comunaOrigen
		   LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		   WHERE co.comuna = ?1 AND cd.comuna = ?2
		     AND v.tiempoViaje > 0 AND d.distEuclidiana > 0
		 ),
		 modes AS (
		   SELECT v.modoAgregado, COUNT(*) AS n
		   FROM viaje v
		   LEFT JOIN comuna co ON co.id = v.comunaOrigen
		   LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		   WHERE co.comuna = ?1 AND cd.comuna = ?2
		   GROUP BY v.modoAgregado
		 )
		 SELECT
		   t.total_viajes, t.distancia_promedio_km, t.tiempo_promedio_min, t.velocidad_promedio_kmh,
		   COALESCE(m_bici.n, 0) AS n_viajes_bicicleta,
		   COALESCE(m_auto.n, 0) AS n_viajes_auto,
		   COALESCE(m_micro.n, 0) AS n_viajes_micro,
		   COALESCE(m_metro.n, 0) AS n_viajes_metro,
		   COALESCE(m_pie.n, 0) AS n_viajes_pie
		 FROM totals t
		 LEFT JOIN modes m_bici ON m_bici.modoAgregado = '9'
		 LEFT JOIN modes m_auto ON m_auto.modoAgregado = '1'
		 LEFT JOIN modes m_micro ON m_micro.modoAgregado IN ('2', '3', '11', '12', '14')
		 LEFT JOIN modes m_metro ON m_metro.modoAgregado = '4'
		 LEFT JOIN modes m_pie ON m_pie.modoAgregado = '8'`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: ResumenViaje[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return (
				results[0] ?? {
					total_viajes: 0,
					distancia_promedio_km: 0,
					tiempo_promedio_min: 0,
					velocidad_promedio_kmh: 0,
					n_viajes_bicicleta: 0,
					n_viajes_auto: 0,
					n_viajes_micro: 0,
					n_viajes_metro: 0,
					n_viajes_pie: 0,
				}
			);
		} catch {
			return {
				total_viajes: 0,
				distancia_promedio_km: 0,
				tiempo_promedio_min: 0,
				velocidad_promedio_kmh: 0,
				n_viajes_bicicleta: 0,
				n_viajes_auto: 0,
				n_viajes_micro: 0,
				n_viajes_metro: 0,
				n_viajes_pie: 0,
			};
		}
	});

const getStatsPorModo = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<ModoRow[]> => {
		const query = `
		 WITH cats AS (
		   SELECT v.viaje,
		     CASE
		       WHEN v.modoAgregado IN ('1','6','17','18', '10', '7', '5', '15')
		         THEN 'Auto'
		       WHEN v.modoAgregado IN ('2','3','11','12','13','14') THEN 'Bus'
		       WHEN v.modoAgregado IN ('4','16') THEN 'Metro/Tren'
		       WHEN v.modoAgregado IN ('8','9') THEN 'No Motorizado'
		       ELSE 'Otro'
		     END AS cat_modo,
		     d.distEuclidiana,
		     v.tiempoViaje
		   FROM viaje v
		   LEFT JOIN distancia_viaje d ON d.viaje = v.viaje
		   LEFT JOIN comuna co ON co.id = v.comunaOrigen
		   LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		   WHERE co.comuna = ?1 AND cd.comuna = ?2
		     AND v.tiempoViaje > 0 AND d.distEuclidiana > 0
		 )
		 SELECT
		   cat_modo AS modo,
		   cat_modo AS modoNombre,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje,
		   ROUND(AVG(distEuclidiana * 60.0 / tiempoViaje / 1000), 1) AS velocidad_promedio,
		   ROUND(AVG(tiempoViaje), 1) AS tiempo_promedio_min,
		   ROUND(AVG(distEuclidiana), 2) / 1000 AS distancia_promedio_km
		 FROM cats
		 GROUP BY cat_modo
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): { all(): Promise<{ results: ModoRow[] }> };
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

const getStatsPorProposito = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<PropositoRow[]> => {
		const query = `
		 SELECT
		   pa.propositoEstraus AS proposito,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 LEFT JOIN proposito_agregado pa ON pa.id = v.propositoAgregado
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		 GROUP BY v.propositoAgregado
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: PropositoRow[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

const getStatsPorPeriodo = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<PeriodoRow[]> => {
		const query = `
		 SELECT
		   p.periodos AS periodo,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 LEFT JOIN periodo p ON p.id = v.periodo
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		 GROUP BY v.periodo
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: PeriodoRow[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

const getStatsPorTiempoMedio = createServerFn({ method: "POST" })
	.inputValidator(validateOrigenDestino)
	.handler(async ({ data }): Promise<TiempoMedioRow[]> => {
		const query = `
		 SELECT
		   tm.tiempoMedio,
		   COUNT(*) AS n_viajes,
		   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 LEFT JOIN tiempo_medio tm ON tm.id = v.tiempoMedio
		 WHERE co.comuna = ?1 AND cd.comuna = ?2
		 GROUP BY v.tiempoMedio
		 ORDER BY n_viajes DESC`;
		try {
			const stmt = env.EOD2012.prepare(query) as unknown as {
				bind(...values: string[]): {
					all(): Promise<{ results: TiempoMedioRow[] }>;
				};
			};
			const { results } = await stmt.bind(data.origen, data.destino).all();
			return results;
		} catch {
			return [];
		}
	});

// ── search params ─────────────────────────────────────

const searchSchema = z.object({
	origen: z.string().optional(),
	destino: z.string().optional(),
});

// ── ruta ──────────────────────────────────────────────

export const Route = createFileRoute("/comparador")({
	validateSearch: searchSchema,
	component: ComparadorPage,
	loaderDeps: ({ search }) => ({
		origen: search.origen ?? "",
		destino: search.destino ?? "",
	}),
	loader: async ({ deps }) => {
		const comunas = await getComunas();
		if (!deps.origen || !deps.destino) {
			return {
				comunas,
				stats: [] as StatsRow[],
				total: 0,
				resumen: defaultResumen(),
				statsModo: [] as ModoRow[],
				statsProposito: [] as PropositoRow[],
				statsPeriodo: [] as PeriodoRow[],
				statsTiempoMedio: [] as TiempoMedioRow[],
				origen: "",
				destino: "",
			};
		}
		const [
			stats,
			total,
			resumen,
			statsModo,
			statsProposito,
			statsPeriodo,
			statsTiempoMedio,
		] = await Promise.all([
			getEstadisticasViajes({
				data: { origen: deps.origen, destino: deps.destino },
			}),
			getTotalViajes({ data: { origen: deps.origen, destino: deps.destino } }),
			getResumenViaje({ data: { origen: deps.origen, destino: deps.destino } }),
			getStatsPorModo({ data: { origen: deps.origen, destino: deps.destino } }),
			getStatsPorProposito({
				data: { origen: deps.origen, destino: deps.destino },
			}),
			getStatsPorPeriodo({
				data: { origen: deps.origen, destino: deps.destino },
			}),
			getStatsPorTiempoMedio({
				data: { origen: deps.origen, destino: deps.destino },
			}),
		]);
		return {
			comunas,
			stats,
			total,
			resumen,
			statsModo,
			statsProposito,
			statsPeriodo,
			statsTiempoMedio,
			origen: deps.origen,
			destino: deps.destino,
		};
	},
});

function defaultResumen(): ResumenViaje {
	return {
		total_viajes: 0,
		distancia_promedio_km: 0,
		tiempo_promedio_min: 0,
		velocidad_promedio_kmh: 0,
		n_viajes_bicicleta: 0,
		n_viajes_auto: 0,
		n_viajes_micro: 0,
		n_viajes_metro: 0,
		n_viajes_pie: 0,
	};
}

// ── componente ────────────────────────────────────────

function ComparadorPage() {
	const {
		comunas,
		total,
		origen,
		destino,
		resumen,
		statsModo,
	} = Route.useLoaderData();
	const navigate = Route.useNavigate();

	const [sliderState, setSliderState] = React.useState<
		Record<string, { delta: number; locked: boolean }>
	>({});

	const [userAdjustedModes, setUserAdjustedModes] = React.useState<Set<string>>(
		new Set(),
	);

	const initialStatsModoMap = React.useMemo(
		() => new Map(statsModo.map((m) => [m.modo ?? "", m.porcentaje])),
		[statsModo],
	);

	const simStatsModo = redistributeBySliders(
		statsModo,
		sliderState,
		userAdjustedModes,
		total,
	);

	const simTotal = total;

	const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const o = form.get("origen") as string;
		const d = form.get("destino") as string;
		setSliderState({});
		setUserAdjustedModes(new Set());
		if (o && d) {
			navigate({ search: { origen: o, destino: d } });
		}
	};

	const _handleReset = () => {
		setSliderState({});
		setUserAdjustedModes(new Set());
	};

	return (
		<main className="mx-auto max-w-5xl px-6 py-8">
			<h1 className="mb-6 text-2xl font-black tracking-tight text-[#102f37]">
				Estadísticas de Viajes
			</h1>

			<form
				onSubmit={handleSubmit}
				className="mb-8 flex flex-wrap items-end gap-4"
			>
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="origen"
						className="text-xs font-bold uppercase tracking-wider text-[#5b777c]"
					>
						Comuna origen
					</label>
					<select
						id="origen"
						name="origen"
						defaultValue={origen ?? ""}
						className="min-w-[200px] rounded-xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-[#102f37] shadow-[0_8px_30px_rgba(16,47,55,0.08)] backdrop-blur-sm outline-none focus:ring-2 focus:ring-[#168a76]"
						required
					>
						<option value="">Selecciona…</option>
						{comunas.map((c) => (
							<option key={c.id} value={c.comuna}>
								{c.comuna}
							</option>
						))}
					</select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label
						htmlFor="destino"
						className="text-xs font-bold uppercase tracking-wider text-[#5b777c]"
					>
						Comuna destino
					</label>
					<select
						id="destino"
						name="destino"
						defaultValue={destino ?? ""}
						className="min-w-[200px] rounded-xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-[#102f37] shadow-[0_8px_30px_rgba(16,47,55,0.08)] backdrop-blur-sm outline-none focus:ring-2 focus:ring-[#168a76]"
						required
					>
						<option value="">Selecciona…</option>
						{comunas.map((c) => (
							<option key={c.id} value={c.comuna}>
								{c.comuna}
							</option>
						))}
					</select>
				</div>

				<button
					type="submit"
					className="rounded-full bg-[#102f37] px-6 py-2.5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#1c4851] active:translate-y-0"
				>
					Buscar
				</button>
			</form>

			{origen && destino && (
				<section>
					<div className="mb-6 flex items-baseline justify-between">
						<h2 className="text-lg font-bold text-[#102f37]">
							{origen} → {destino}
						</h2>
						<span className="text-sm font-semibold text-[#5b777c]">
							Total viajes:{" "}
							<strong className="text-[#102f37]">
								{simTotal.toLocaleString("es-CL")}
							</strong>
							{Object.entries(sliderState).some(([modo, s]) => {
								const initial =
									Math.round(
										(statsModo.find((m) => m.modo === modo)?.porcentaje ?? 0) *
											10,
									) / 10;
								return s.delta !== initial || s.locked;
							}) && (
								<span className="ml-2 text-xs text-[#168a76]">
									(simulación)
								</span>
							)}
						</span>
					</div>

					{Object.entries(sliderState).some(([modo, s]) => {
						const initial =
							Math.round(
								(statsModo.find((m) => m.modo === modo)?.porcentaje ?? 0) * 10,
							) / 10;
						return s.delta !== initial || s.locked;
					}) && (
						<div className="mb-4 rounded-xl border border-[#168a76] bg-[#168a76]/10 p-4">
							<p className="text-sm font-bold text-[#168a76]">
								🔁 Simulación activa — ajusta los sliders para redistribuir
								viajes
							</p>
							<button
								type="button"
								onClick={() => setSliderState({})}
								className="mt-2 text-xs font-medium text-[#102f37] underline hover:text-[#168a76]"
							>
								✕ Reiniciar simulación
							</button>
						</div>
					)}

					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
						<div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								Viajes Totales
							</p>
							<p className="mt-2 text-3xl font-black text-[#102f37]">
								{simTotal.toLocaleString("es-CL")}
							</p>
						</div>
						<div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								Dist. Promedio
							</p>
							<p className="mt-2 text-3xl font-black text-[#102f37]">
								{resumen.distancia_promedio_km.toLocaleString("es-CL")}{" "}
								<span className="text-sm font-medium text-[#5b777c]">km</span>
							</p>
						</div>
						<div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								Tiempo Promedio
							</p>
							<p className="mt-2 text-3xl font-black text-[#102f37]">
								{resumen.tiempo_promedio_min.toFixed(0)}{" "}
								<span className="text-sm font-medium text-[#5b777c]">min</span>
							</p>
						</div>
						<div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								Velocidad Promedio
							</p>
							<p className="mt-2 text-3xl font-black text-[#102f37]">
								{(resumen.velocidad_promedio_kmh / 1000).toFixed(1)}{" "}
								<span className="text-sm font-medium text-[#5b777c]">km/h</span>
							</p>
						</div>
					</div>

					<div className="mt-6 grid gap-6 md:grid-cols-4">
						<div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm text-center">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								Auto
							</p>
							<p className="mt-1 text-2xl font-black text-[#168a76]">
								{Math.round(
									simStatsModo
										.filter((m) => m.modo === "Auto")
										.reduce((s, m) => s + m.n_viajes, 0),
								).toLocaleString("es-CL")}
							</p>
						</div>
						<div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm text-center">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								Bus
							</p>
							<p className="mt-1 text-2xl font-black text-[#168a76]">
								{Math.round(
									simStatsModo
										.filter((m) => m.modo === "Bus")
										.reduce((s, m) => s + m.n_viajes, 0),
								).toLocaleString("es-CL")}
							</p>
						</div>
						<div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm text-center">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								Metro/Tren
							</p>
							<p className="mt-1 text-2xl font-black text-[#168a76]">
								{Math.round(
									simStatsModo
										.filter((m) => m.modo === "Metro/Tren")
										.reduce((s, m) => s + m.n_viajes, 0),
								).toLocaleString("es-CL")}
							</p>
						</div>
						<div className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm text-center">
							<p className="text-xs font-bold uppercase tracking-wider text-[#5b777c]">
								No Motorizado
							</p>
							<p className="mt-1 text-2xl font-black text-[#168a76]">
								{Math.round(
									simStatsModo
										.filter((m) => m.modo === "No Motorizado")
										.reduce((s, m) => s + m.n_viajes, 0),
								).toLocaleString("es-CL")}
							</p>
						</div>
					</div>

					{simStatsModo.length === 0 ? (
						<p className="mt-6 rounded-2xl border border-white/60 bg-white/70 p-6 text-sm text-[#5b777c] backdrop-blur-sm">
							No se encontraron viajes para este par de comunas.
						</p>
					) : (
						<div className="mt-6 overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
							<div className="border-b border-[#d0e0d8] px-5 py-3 flex items-center justify-between">
								<h3 className="text-sm font-bold text-[#102f37]">
									Simulación de Distribución Modal
								</h3>
								<button
									type="button"
									onClick={() => setSliderState({})}
									className="flex items-center gap-1.5 rounded-full bg-[#102f37] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1c4851] active:translate-y-0"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2.5"
										strokeLinecap="round"
										strokeLinejoin="round"
										role="img"
										aria-label="Reiniciar simulación"
									>
										<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
										<path d="M3 3v5h5" />
									</svg>
									Reset
								</button>
							</div>
							<div className="divide-y divide-[#eef4eb]">
								{simStatsModo.map((row) => {
									const modo = row.modo ?? "";
const currentPct = Math.round(row.porcentaje * 10) / 10;
									const initialPct =
										Math.round((initialStatsModoMap.get(modo) ?? 0) * 10) / 10;
									const state = sliderState[modo];
									const isLocked = state?.locked ?? false;
									const isAdjusted = userAdjustedModes.has(modo);
									const range = getSliderRange(
										modo,
										statsModo,
										sliderState,
										userAdjustedModes,
									);

									const handleChange = (val: number) => {
										const clamped = Math.max(
											range.min,
											Math.min(range.max, val),
										);
										setSliderState((prev) => ({
											...prev,
											[modo]: {
												delta: clamped,
												locked: isLocked,
											},
										}));
										setUserAdjustedModes((prev) => {
											const next = new Set(prev);
											next.add(modo);
											return next;
										});
									};

									return (
										<div
											key={modo}
											className="flex items-center gap-4 px-5 py-3"
										>
											<div className="w-36 flex-shrink-0">
												<span className="text-sm font-medium text-[#102f37]">
													{row.modoNombre ?? "—"}
												</span>
											</div>
											<div className="flex-1">
												<div className="flex items-center gap-3">
													<div className="relative h-2 flex-1 rounded-full bg-[#eef4eb]">
														<div
															className="absolute top-0 left-0 h-full rounded-full bg-[#168a76]/40 transition-all"
															style={{
																width: `${Math.min(currentPct, range.max) - range.min}%`,
																left: `${range.min}%`,
															}}
														/>
														<input
															type="range"
															min={Math.round(range.min * 10) / 10}
															max={Math.round(range.max * 10) / 10}
															step="0.1"
															value={currentPct}
															disabled={isLocked}
															onChange={(e) =>
																handleChange(Number(e.target.value))
															}
															className={`absolute inset-0 h-full w-full cursor-pointer opacity-0 ${
																isLocked ? "cursor-not-allowed" : "cursor-pointer"
															}`}
														/>
														<div
															className={`pointer-events-none absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white shadow transition-all ${
																isLocked
																	? "bg-[#102f37]"
																	: isAdjusted
																		? "bg-[#168a76]"
																		: "bg-[#d0e0d8]"
															}`}
															style={{ left: `calc(${currentPct}% - 6px)` }}
														/>
													</div>
													<span className="w-14 text-right text-sm font-medium text-[#102f37]">
														{Math.round(currentPct * 10) / 10}%
													</span>
													<button
														type="button"
														onClick={() =>
															setSliderState((prev) => ({
																...prev,
																[modo]: {
																	delta: currentPct,
																	locked: !isLocked,
																},
															}))
														}
														className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs transition ${
															isLocked
																? "border-[#102f37] bg-[#102f37] text-white"
																: "border-[#d0e0d8] text-[#d0e0d8] hover:border-[#168a76] hover:text-[#168a76]"
														}`}
													>
														🔒
													</button>
												</div>
												{isLocked ? (
													<p className="mt-0.5 text-xs text-[#5b777c]">
														Bloqueado en {Math.round(initialPct * 10) / 10}%
													</p>
												) : isAdjusted ? (
													<p className="mt-0.5 text-xs text-[#5b777c]">
														{Math.round(initialPct * 10) / 10}% →{" "}
														{Math.round(currentPct * 10) / 10}% (
														{Math.round(row.n_viajes).toLocaleString("es-CL")} viajes)
													</p>
												) : null}
											</div>
										</div>
									);
})}
							</div>
						</div>
						<div className="mt-6 grid gap-6 md:grid-cols-2">
							<div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
								<div className="border-b border-[#d0e0d8] px-5 py-3">
									<h3 className="text-sm font-bold text-[#102f37]">
										Por Propósito
										{Object.entries(sliderState).some(([modo, s]) => {
											const initial =
												Math.round(
													(statsModo.find((m) => m.modo === modo)
														?.porcentaje ?? 0) * 10,
												) / 10;
											return s.delta !== initial || s.locked;
										}) && (
											<span className="ml-2 text-xs text-[#168a76]">
												(simulado)
											</span>
										)}
									</h3>
								</div>
								<table className="w-full text-sm">
									<tbody>
										{statsProposito.map((row) => (
											<tr
												key={row.proposito ?? "∅"}
												className="border-b border-[#eef4eb] last:border-0"
											>
												<td className="px-5 py-3 font-medium text-[#102f37]">
													{row.proposito ?? "—"}
												</td>
												<td className="px-5 py-3 text-right tabular-nums text-[#102f37]">
													{Math.round(row.n_viajes).toLocaleString("es-CL")}
												</td>
												<td className="px-5 py-3 text-right tabular-nums text-[#102f37]">
													{row.porcentaje}%
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							<div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
								<div className="border-b border-[#d0e0d8] px-5 py-3">
									<h3 className="text-sm font-bold text-[#102f37]">
										Por Horario
										{Object.entries(sliderState).some(([modo, s]) => {
											const initial =
												Math.round(
													(statsModo.find((m) => m.modo === modo)
														?.porcentaje ?? 0) * 10,
												) / 10;
											return s.delta !== initial || s.locked;
										}) && (
											<span className="ml-2 text-xs text-[#168a76]">
												(simulado)
											</span>
										)}
									</h3>
								</div>
								<table className="w-full text-sm">
									<tbody>
										{statsPeriodo.map((row) => (
											<tr
												key={row.periodo ?? "∅"}
												className="border-b border-[#eef4eb] last:border-0"
											>
												<td className="px-5 py-3 font-medium text-[#102f37]">
													{row.periodo ?? "—"}
												</td>
												<td className="px-5 py-3 text-right tabular-nums text-[#102f37]">
													{Math.round(row.n_viajes).toLocaleString("es-CL")}
												</td>
												<td className="px-5 py-3 text-right tabular-nums text-[#102f37]">
													{row.porcentaje}%
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						<div className="mt-6 overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-[0_16px_50px_rgba(16,47,55,0.1)] backdrop-blur-sm">
							<div className="border-b border-[#d0e0d8] px-5 py-3">
								<h3 className="text-sm font-bold text-[#102f37]">
									Por Tiempo de Viaje
									{Object.entries(sliderState).some(([modo, s]) => {
										const initial =
											Math.round(
												(statsModo.find((m) => m.modo === modo)
													?.porcentaje ?? 0) * 10,
											) / 10;
										return s.delta !== initial || s.locked;
									}) && (
										<span className="ml-2 text-xs text-[#168a76]">
											(simulado)
										</span>
									)}
								</h3>
							</div>
							<table className="w-full text-sm">
								<tbody>
									{statsTiempoMedio.map((row) => (
										<tr
											key={row.tiempoMedio ?? "∅"}
											className="border-b border-[#eef4eb] last:border-0"
										>
											<td className="px-5 py-3 font-medium text-[#102f37]">
												{row.tiempoMedio ?? "—"}
											</td>
											<td className="px-5 py-3 text-right tabular-nums text-[#102f37]">
												{Math.round(row.n_viajes).toLocaleString("es-CL")}
											</td>
											<td className="px-5 py-3 text-right tabular-nums text-[#102f37]">
												{row.porcentaje}%
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				)}
			</main>
		);
	}
}
