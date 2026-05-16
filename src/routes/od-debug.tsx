import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	type DestinoRow,
	getComunasList,
	getDestinosDesdeComuna,
	getModoAgregadoValues,
} from "#/map/server-od";

export const Route = createFileRoute("/od-debug")({
	component: OdDebugPage,
});

function OdDebugPage() {
	const [comunas, setComunas] = useState<string[]>([]);
	const [modos, setModos] = useState<string[]>([]);
	const [selectedComuna, setSelectedComuna] = useState("");
	const [selectedModos, setSelectedModos] = useState<string[]>([]);
	const [results, setResults] = useState<DestinoRow[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		getComunasList().then(setComunas);
		getModoAgregadoValues().then(setModos);
	}, []);

	const handleQuery = async () => {
		if (!selectedComuna) return;
		setLoading(true);
		try {
			const payload: { comunaOrigen: string; modos?: string[] } = {
				comunaOrigen: selectedComuna,
			};
			if (selectedModos.length > 0) {
				payload.modos = selectedModos;
			}
			const data = await getDestinosDesdeComuna({ data: payload });
			setResults(data);
		} finally {
			setLoading(false);
		}
	};

	const toggleModo = (modo: string) => {
		setSelectedModos((prev) =>
			prev.includes(modo) ? prev.filter((m) => m !== modo) : [...prev, modo],
		);
	};

	const totalViajes = results.reduce(
		(sum, r) => sum + (r.total_viajes || 0),
		0,
	);

	return (
		<main className="page-wrap py-8">
			<h1 className="mb-4 text-2xl font-semibold">Debug Origen-Destino</h1>

			<div className="mb-6 space-y-4 rounded-2xl border border-[#d9e7e4] bg-white/72 p-4">
				<div>
					<label
						className="mb-1 block text-sm font-bold text-[#102f37]"
						htmlFor="comuna-select"
					>
						Comuna origen
					</label>
					<select
						id="comuna-select"
						className="w-full rounded-xl border border-[#b9d7d1] bg-white px-3 py-2 text-sm"
						value={selectedComuna}
						onChange={(e) => setSelectedComuna(e.target.value)}
					>
						<option value="">Selecciona una comuna...</option>
						{comunas.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
				</div>

				<div>
					<span className="mb-2 block text-sm font-bold text-[#102f37]">
						Modo agregado (opcional)
					</span>
					<div className="flex flex-wrap gap-2">
						{modos.map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => toggleModo(m)}
								className={
									selectedModos.includes(m)
										? "rounded-full border border-[#168a76] bg-[#effaf5] px-3 py-1 text-xs font-bold text-[#168a76]"
										: "rounded-full border border-[#d9e7e4] bg-white px-3 py-1 text-xs font-bold text-[#5b777c]"
								}
							>
								{m}
							</button>
						))}
					</div>
				</div>

				<button
					type="button"
					onClick={handleQuery}
					disabled={!selectedComuna || loading}
					className="rounded-2xl bg-[#168a76] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
				>
					{loading ? "Consultando..." : "Consultar destinos"}
				</button>
			</div>

			{results.length > 0 && (
				<div className="rounded-2xl border border-[#d9e7e4] bg-white/72 p-4">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="text-lg font-bold text-[#102f37]">Resultados</h2>
						<span className="text-sm text-[#5b777c]">
							Total ponderado: {Math.round(totalViajes).toLocaleString("es-CL")}{" "}
							viajes
						</span>
					</div>
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b text-left">
								<th className="py-2 pr-4">Destino</th>
								<th className="py-2 pr-4 text-right">Viajes ponderados</th>
								<th className="py-2 pr-4 text-right">% del total</th>
							</tr>
						</thead>
						<tbody>
							{results.map((r) => (
								<tr
									key={r.destino ?? "∅"}
									className="border-b border-[var(--line)]"
								>
									<td className="py-1 pr-4">{r.destino ?? "—"}</td>
									<td className="py-1 pr-4 text-right tabular-nums">
										{Math.round(r.total_viajes).toLocaleString("es-CL")}
									</td>
									<td className="py-1 pr-4 text-right tabular-nums">
										{totalViajes > 0
											? `${((r.total_viajes / totalViajes) * 100).toFixed(1)}%`
											: "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</main>
	);
}
