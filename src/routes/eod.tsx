import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

type Row = {
	comuna_origen: string | null;
	comuna_destino: string | null;
	n_viajes: number;
};

const getViajesOD = createServerFn({ method: "GET" }).handler(async () => {
	const { results } = await env.DB.prepare(
		`SELECT co.comuna AS comuna_origen,
		        cd.comuna AS comuna_destino,
		        COUNT(*)  AS n_viajes
		 FROM viaje v
		 LEFT JOIN comuna co ON co.id = v.comunaOrigen
		 LEFT JOIN comuna cd ON cd.id = v.comunaDestino
		 GROUP BY v.comunaOrigen, v.comunaDestino
		 ORDER BY n_viajes DESC`,
	).all<Row>();
	return results;
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
						<th className="py-2 pr-4 text-right">n_viajes</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr
							key={`${r.comuna_origen ?? "∅"}→${r.comuna_destino ?? "∅"}`}
							className="border-b border-[var(--line)]"
						>
							<td className="py-1 pr-4">{r.comuna_origen ?? "—"}</td>
							<td className="py-1 pr-4">{r.comuna_destino ?? "—"}</td>
							<td className="py-1 pr-4 text-right tabular-nums">
								{r.n_viajes.toLocaleString("es-CL")}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</main>
	);
}
