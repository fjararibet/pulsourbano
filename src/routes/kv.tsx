import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

type KVRow = {
	key: string;
	took_ms: number;
	row_count: number;
	size_kb: string;
};

type D1Row = {
	key: string;
	took_ms: number;
	row_count: number;
};

const getKV = createServerFn({ method: "GET" }).handler(async () => {
	const start = Date.now();
	const keys = [
		"geo:buses",
		"geo:metro",
		"geo:ciclobias",
		"geo:comunas",
		"sim:frequencies",
		"sim:travel_times",
	] as const;
	const results = await Promise.all(
		keys.map(async (key) => {
			const startKey = Date.now();
			const data = await env.ESGRIMAKV.get<string>(key);
			const took = Date.now() - startKey;
			const parsed = data ? (JSON.parse(data) as unknown) : null;
			const rowCount = Array.isArray(parsed)
				? (parsed as unknown[]).length
				: typeof parsed === "object" && parsed !== null
					? Object.keys(parsed).length
					: 0;
			return {
				key,
				took_ms: took,
				row_count: rowCount,
				size_kb: data ? (new Blob([data]).size / 1024).toFixed(1) : "0",
			} satisfies KVRow;
		}),
	);
	const total = Date.now() - start;
	return { results, total_ms: total } as {
		results: KVRow[];
		total_ms: number;
	};
});

const getD1 = createServerFn({ method: "GET" }).handler(async () => {
	const start = Date.now();
	const queries = [
		{
			name: "bus_features",
			sql: "SELECT geometry, properties FROM bus_features LIMIT 1",
		},
		{
			name: "metro_features",
			sql: "SELECT kind, geometry, properties FROM metro_features LIMIT 1",
		},
		{
			name: "comunas",
			sql: "SELECT geometry, cod_comuna, nombre_comuna, provincia, region FROM comunas LIMIT 1",
		},
		{
			name: "bus_frequencies",
			sql: "SELECT route_key, mean_headway_seconds, samples FROM bus_frequencies LIMIT 10",
		},
		{
			name: "bus_travel_times",
			sql: "SELECT route_key, mean_minutes, mean_km, avg_kmh, samples FROM bus_travel_times LIMIT 10",
		},
	] as const;

	const results = await Promise.all(
		queries.map(async (q) => {
			const startQ = Date.now();
			const { results: rows } = await env.DTPMGEO.prepare(q.sql).all();
			const took = Date.now() - startQ;
			return {
				key: q.name,
				took_ms: took,
				row_count: rows.length,
			} satisfies D1Row;
		}),
	);
	const total = Date.now() - start;
	return { results, total_ms: total } as {
		results: D1Row[];
		total_ms: number;
	};
});

export const Route = createFileRoute("/kv")({
	loader: async () => {
		const [kv, d1] = await Promise.all([getKV(), getD1()]);
		return { kv, d1 };
	},
});

export default function KvPage() {
	const { kv, d1 } = Route.useLoaderData();

	return (
		<main className="page-wrap py-8 max-w-4xl">
			<h1 className="mb-6 text-2xl font-semibold">KV + D1 Benchmark</h1>

			<section className="mb-8">
				<h2 className="mb-2 text-lg font-semibold flex items-center gap-2">
					KV Cache
					<span className="text-sm font-normal text-[var(--muted)]">
						(kb = payload size, rows = item count, ms = query time)
					</span>
				</h2>
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b text-left">
							<th className="py-2 pr-4">key</th>
							<th className="py-2 pr-4 text-right">rows</th>
							<th className="py-2 pr-4 text-right">size (kb)</th>
							<th className="py-2 pr-4 text-right">took (ms)</th>
						</tr>
					</thead>
					<tbody>
						{kv.results.map((r) => (
							<tr key={r.key} className="border-b border-[var(--line)]">
								<td className="py-1 pr-4 font-mono text-xs">{r.key}</td>
								<td className="py-1 pr-4 text-right tabular-nums">
									{r.row_count}
								</td>
								<td className="py-1 pr-4 text-right tabular-nums">
									{r.size_kb}
								</td>
								<td className="py-1 pr-4 text-right tabular-nums font-mono">
									{r.took_ms}ms
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="font-semibold">
							<td className="pt-2">total</td>
							<td className="pt-2 text-right">
								{kv.results.reduce((s, r) => s + r.row_count, 0)}
							</td>
							<td className="pt-2 text-right">
								{kv.results
									.reduce((s, r) => s + parseFloat(r.size_kb), 0)
									.toFixed(1)}
							</td>
							<td className="pt-2 text-right">{kv.total_ms}ms</td>
						</tr>
					</tfoot>
				</table>
				<div className="mt-2 text-sm text-[var(--muted)]">
					KV total:
					<span className="font-mono font-semibold">{kv.total_ms}ms</span>
				</div>
			</section>

			<section className="mb-8">
				<h2 className="mb-2 text-lg font-semibold">D1 Direct (no cache)</h2>
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b text-left">
							<th className="py-2 pr-4">query</th>
							<th className="py-2 pr-4 text-right">rows</th>
							<th className="py-2 pr-4 text-right">took (ms)</th>
						</tr>
					</thead>
					<tbody>
						{d1.results.map((r) => (
							<tr key={r.key} className="border-b border-[var(--line)]">
								<td className="py-1 pr-4 font-mono text-xs">{r.key}</td>
								<td className="py-1 pr-4 text-right tabular-nums">
									{r.row_count}
								</td>
								<td className="py-1 pr-4 text-right tabular-nums font-mono">
									{r.took_ms}ms
								</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="font-semibold">
							<td className="pt-2">total</td>
							<td className="pt-2 text-right">
								{d1.results.reduce((s, r) => s + r.row_count, 0)}
							</td>
							<td className="pt-2 text-right">{d1.total_ms}ms</td>
						</tr>
					</tfoot>
				</table>
				<div className="mt-2 text-sm text-[var(--muted)]">
					D1 total:
					<span className="font-mono font-semibold">{d1.total_ms}ms</span>
				</div>
			</section>

			<div className="p-4 rounded border border-[var(--line)] bg-[var(--surface)]">
				<h3 className="mb-2 font-semibold">Comparison</h3>
				<p className="text-sm">
					KV: <span className="font-mono font-semibold">{kv.total_ms}ms</span>
					&nbsp;&middot;&nbsp;D1:{" "}
					<span className="font-mono font-semibold">{d1.total_ms}ms</span>
					&nbsp;&middot;&nbsp;Speedup:{" "}
					<span className="font-mono font-semibold">
						{d1.total_ms > 0
							? `${(d1.total_ms / kv.total_ms).toFixed(1)}x`
							: "n/a"}
					</span>
				</p>
			</div>
		</main>
	);
}
