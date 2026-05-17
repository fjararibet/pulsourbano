import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Row = {
	fid: number;
	name: string;
	folderpath: string;
	popupinfo: string;
	longitud_km: number;
	shape_length_m: number;
	geometry: string;
};

async function main() {
	const filePath = resolve(process.argv[2] ?? "./public/data/ciclovias.geojson");
	const raw = await readFile(filePath, "utf8");
	const data = JSON.parse(raw);

	const rows: Row[] = data.features.map((feature: {
		properties: {
			FID: number;
			objectid_1: number;
			objectid: number;
			oid_: number;
			name: string;
			folderpath: string;
			popupinfo: string;
			longitud: number;
			Shape__Length: number;
		};
		geometry: unknown;
	}) => ({
		fid: feature.properties.FID,
		name: feature.properties.name,
		folderpath: feature.properties.folderpath,
		popupinfo: feature.properties.popupinfo,
		longitud_km: feature.properties.longitud,
		shape_length_m: feature.properties.Shape__Length,
		geometry: JSON.stringify(feature.geometry),
	}));

	const outPath = resolve(process.argv[3] ?? "/tmp/ciclovias-inserts.sql");
	const batchSize = 50;
	const out: string[] = [];
	for (let i = 0; i < rows.length; i += batchSize) {
		const batch = rows.slice(i, i + batchSize);
		const values = batch
			.map(
				(r) =>
					`(${r.fid}, ${escape(r.name)}, ${escape(r.folderpath)}, ${escape(r.popupinfo)}, ${r.longitud_km}, ${r.shape_length_m}, ${escape(r.geometry)})`,
			)
			.join(",\n");

		out.push(
			`INSERT INTO ciclovias (fid, name, folderpath, popupinfo, longitud_km, shape_length_m, geometry) VALUES\n${values};`,
		);
	}

	await writeFile(outPath, out.join("\n"));
	console.error(`Wrote ${rows.length} rows to ${outPath}`);
}

function escape(val: unknown): string {
	if (val === null || val === undefined) return "NULL";
	const s = String(val);
	if (s === "NULL") return "NULL";
	return `'${s.replace(/'/g, "''")}'`;
}

main().catch(console.error);
