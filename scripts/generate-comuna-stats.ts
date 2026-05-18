import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface TripRow {
	comunaOrigen: string;
	comunaDestino: string;
	cat_modo: string;
	distEuclidiana: number;
	tiempoViaje: number;
}

interface ModoRow {
	modo: string;
	modoNombre: string;
	n_viajes: number;
	porcentaje: number;
	velocidad_promedio: number;
	tiempo_promedio_min: number;
	distancia_promedio_km: number;
}

const ROWS_QUERY = `
  SELECT co.comuna AS comunaOrigen, cd.comuna AS comunaDestino,
    CASE
      WHEN v.modoAgregado IN ('1','6','17','18','10','7','5','15')
        THEN 'Auto'
      WHEN v.modoAgregado IN ('2','3','11','12','13','14') THEN 'Bus'
      WHEN v.modoAgregado IN ('4','16') THEN 'Metro/Tren'
      WHEN v.modoAgregado IN ('8','9') THEN 'No Motorizado'
      ELSE 'Otro'
    END AS cat_modo,
    d.distEuclidiana, v.tiempoViaje
  FROM viaje v
  LEFT JOIN distancia_viaje d ON d.viaje = v.viaje
  LEFT JOIN comuna co ON co.id = v.comunaOrigen
  LEFT JOIN comuna cd ON cd.id = v.comunaDestino
  WHERE v.tiempoViaje > 0 AND d.distEuclidiana > 0
`;

function normalizeName(s: string): string {
	return s
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase();
}

const useRemote = process.argv.includes("--remote");

function runWrangler(sql: string): TripRow[] {
	const escaped = sql.replace(/"/g, '\\"').replace(/\n/g, " ");
	const target = useRemote ? "--remote" : "--local";
	const cmd = `npx wrangler d1 execute EOD2012 ${target} --json --command="${escaped}"`;
	const stdout = execSync(cmd, {
		encoding: "utf-8",
		maxBuffer: 100 * 1024 * 1024,
	});
	const parsed = JSON.parse(stdout);
	return parsed[0]?.results ?? [];
}

function computeStats(rows: TripRow[]): {
	statsModo: ModoRow[];
	total: number;
} {
	const byMode = new Map<string, TripRow[]>();
	for (const row of rows) {
		const mode = row.cat_modo || "Otro";
		if (!byMode.has(mode)) byMode.set(mode, []);
		byMode.get(mode)!.push(row);
	}

	const total = rows.length;
	const statsModo: ModoRow[] = [];

	for (const [modo, trips] of byMode) {
		const n = trips.length;
		const sumDist = trips.reduce((s, t) => s + t.distEuclidiana, 0);
		const sumTime = trips.reduce((s, t) => s + t.tiempoViaje, 0);
		const sumSpeed = trips.reduce(
			(s, t) => s + (t.distEuclidiana * 60.0) / t.tiempoViaje / 1000,
			0,
		);

		statsModo.push({
			modo,
			modoNombre: modo,
			n_viajes: n,
			porcentaje: Math.round((n / total) * 1000) / 10,
			velocidad_promedio: Math.round((sumSpeed / n) * 10) / 10,
			tiempo_promedio_min: Math.round((sumTime / n) * 10) / 10,
			distancia_promedio_km: Math.round((sumDist / n / 1000) * 100) / 100,
		});
	}

	statsModo.sort((a, b) => b.n_viajes - a.n_viajes);

	return { statsModo, total };
}

function buildNameMap(): Map<string, string> {
	const routesDir = resolve(process.cwd(), "public/data/routes");
	const files = readdirSync(routesDir);
	const names = new Set<string>();

	for (const file of files) {
		const withoutMode = file.replace(/_(auto|bus|bicycle|metro|pedestrian)\.json$/, "");
		const parts = withoutMode.split("_");
		if (parts.length >= 2) {
			const first = parts.slice(0, -1).join("_");
			const last = parts[parts.length - 1]!;
			names.add(decodeURIComponent(first));
			names.add(decodeURIComponent(last));
		}
	}

	const nameMap = new Map<string, string>();
	for (const name of names) {
		nameMap.set(normalizeName(name), name);
	}
	return nameMap;
}

async function main() {
	console.log("Generating comuna pair stats from D1...\n");

	const outDir = resolve(process.cwd(), "public/data/stats");
	if (!existsSync(outDir)) {
		mkdirSync(outDir, { recursive: true });
	}

	const nameMap = buildNameMap();
	console.log(`  Loaded ${nameMap.size} proper-case comuna names from routes`);

	console.log("  Querying all trip data from D1...");
	const rows = runWrangler(ROWS_QUERY);
	console.log(`  Loaded ${rows.length.toLocaleString()} trip rows`);

	const filteredRows = rows.filter(
		(r) => r.comunaOrigen && r.comunaDestino,
	);
	console.log(
		`  After filtering null comuna: ${filteredRows.length.toLocaleString()} rows`,
	);

	const pairMap = new Map<string, TripRow[]>();
	let missingNames = new Set<string>();

	for (const row of filteredRows) {
		const normOri = normalizeName(row.comunaOrigen);
		const normDest = normalizeName(row.comunaDestino);
		const properOri = nameMap.get(normOri);
		const properDest = nameMap.get(normDest);

		if (!properOri) missingNames.add(row.comunaOrigen);
		if (!properDest) missingNames.add(row.comunaDestino);

		const key = `${properOri || normOri}|${properDest || normDest}`;
		if (!pairMap.has(key)) pairMap.set(key, []);
		pairMap.get(key)!.push(row);
	}

	if (missingNames.size > 0) {
		console.log(
			`  Warning: ${missingNames.size} DB comuna names not found in routes:`,
		);
		for (const n of missingNames) {
			console.log(`    - "${n}" (normalized: "${normalizeName(n)}")`);
		}
	}

	console.log(`  Found ${pairMap.size} unique comuna pairs\n`);

	let count = 0;
	const start = Date.now();

	for (const [key, trips] of pairMap) {
		const [origen, destino] = key.split("|");
		if (origen === destino) continue;

		const { statsModo, total } = computeStats(trips);

		const initialStatsMap: Record<string, number> = {};
		for (const s of statsModo) {
			initialStatsMap[s.modo] = s.porcentaje;
		}

		const fileName = `${encodeURIComponent(origen)}_${encodeURIComponent(destino)}.json`;
		writeFileSync(
			join(outDir, fileName),
			JSON.stringify({ statsModo, total, initialStatsMap }),
		);
		count++;
	}

	const elapsed = ((Date.now() - start) / 1000).toFixed(1);
	console.log(`\nGenerated ${count} stats files in ${elapsed}s`);
}

main().catch((e) => {
	console.error("Failed:", e);
	process.exit(1);
});
