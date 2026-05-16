import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getViajesOD = createServerFn({ method: "GET" }).handler(async () => {
	console.log("[eod] handler start (stub)");
	return [
		{ comuna_origen: "TEST", comuna_destino: "TEST", num_viajes_diarios: 1 },
	];
});

export const Route = createFileRoute("/eod")({
	component: EodPage,
	loader: () => getViajesOD(),
});

function EodPage() {
	const rows = Route.useLoaderData();
	return (
		<main className="page-wrap py-8">
			<h1 className="mb-4 text-2xl font-semibold">Viajes Origen-Destino</h1>
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b text-left">
						<th className="py-2 pr-4">comuna_origen</th>
						<th className="py-2 pr-4">comuna_destino</th>
						<th className="py-2 pr-4 text-right">num_viajes_diarios</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r, i) => (
						<tr
							key={`${r.comuna_origen ?? "∅"}-${r.comuna_destino ?? "∅"}-${i}`}
							className="border-b border-[var(--line)]"
						>
							<td className="py-1 pr-4">{r.comuna_origen ?? "—"}</td>
							<td className="py-1 pr-4">{r.comuna_destino ?? "—"}</td>
							<td className="py-1 pr-4 text-right tabular-nums">
								{r.num_viajes_diarios.toLocaleString("es-CL")}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</main>
	);
}
