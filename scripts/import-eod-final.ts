/**
 * Reads CSVs in ./csv_export and emits a SQL dump (INSERT statements only) to
 * stdout. The dump is meant to be piped into wrangler:
 *
 *   npx tsx scripts/import-eod-final.ts > csv_export/dump.sql
 *   npx wrangler d1 execute esgrima --local --file=csv_export/dump.sql
 *
 * The destination tables must already exist (apply the drizzle migration
 * first: `wrangler d1 execute esgrima --local --file=drizzle/0000_legal_nick_fury.sql`).
 */
import { readFileSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";

const outPath = process.argv[2];
const out = outPath ? createWriteStream(outPath) : process.stdout;
const log = (msg: string) => process.stderr.write(`${msg}\n`);

function sqlEscape(v: unknown): string {
	if (v === null || v === undefined) return "NULL";
	if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
	return `'${String(v).replace(/'/g, "''")}'`;
}

function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (char === '"') {
			inQuotes = !inQuotes;
		} else if (char === "," && !inQuotes) {
			result.push(current.trim());
			current = "";
		} else {
			current += char;
		}
	}
	result.push(current.trim());
	return result;
}

function parseValue(value: string, type: string): unknown {
	if (value === "" || value === null || value === undefined) return null;
	if (type === "INTEGER") return value === "" ? null : parseInt(value, 10);
	if (type === "REAL") return value === "" ? null : parseFloat(value);
	return value;
}

type ColumnMapping = { csv: string; db: string; type: string };

const tables: [string, string, ColumnMapping[]][] = [
	["actividad", "Actividad", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Actividad", db: "actividad", type: "TEXT" },
	]],
	["actividad_destino", "ActividadDestino", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "ActividadDestino", db: "actividadDestino", type: "TEXT" },
	]],
	["actividad_empresa", "ActividadEmpresa", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "ActividadEmpresa", db: "actividadEmpresa", type: "TEXT" },
	]],
	["adulto_mayor", "AdultoMayor", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "AdultoMayor", db: "adultoMayor", type: "TEXT" },
	]],
	["autopista", "Autopista", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Autopista", db: "autopista", type: "TEXT" },
		{ csv: "Campo2", db: "campo2", type: "TEXT" },
	]],
	["circulacion_bicicleta", "CirculacionBicicleta", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "CirculacionBicicleta", db: "circulacionBicicleta", type: "TEXT" },
	]],
	["codigo_tiempo", "CódigoTiempo", [
		{ csv: "Código", db: "codigo", type: "TEXT" },
		{ csv: "Observación", db: "observacion", type: "TEXT" },
	]],
	["combustible", "Combustible", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Combustible", db: "combustible", type: "TEXT" },
	]],
	["comuna", "Comuna", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Comuna", db: "comuna", type: "TEXT" },
	]],
	["conoce_transantiago", "ConoceTransantiago", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "ConoceTransantiago", db: "conoceTransantiago", type: "TEXT" },
	]],
	["discapacidad", "Discapacidad", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Discapacidad", db: "discapacidad", type: "TEXT" },
	]],
	["distancia_viaje", "DistanciaViaje", [
		{ csv: "Viaje", db: "viaje", type: "TEXT" },
		{ csv: "DistEuclidiana", db: "distEuclidiana", type: "REAL" },
		{ csv: "DistManhattan", db: "distManhattan", type: "REAL" },
		{ csv: "Imputada", db: "imputada", type: "REAL" },
	]],
	["donde_estudia", "DondeEstudia", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "DondeEstudia", db: "dondeEstudia", type: "TEXT" },
	]],
	["edad_personas", "EdadPersonas", [
		{ csv: "Persona", db: "persona", type: "TEXT" },
		{ csv: "Edad", db: "edad", type: "INTEGER" },
	]],
	["edad_vehiculo", "EdadVehiculo", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "EdadVehiculo", db: "edadVehiculo", type: "TEXT" },
	]],
	["estaciona", "Estaciona", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "estaciona", db: "estaciona", type: "TEXT" },
	]],
	["estaciona_bicicleta", "EstacionaBicicleta", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Campo1", db: "campo1", type: "TEXT" },
	]],
	["estacion_metro", "EstacionMetro", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "EstacionMetro", db: "estacionMetro", type: "TEXT" },
	]],
	["estacion_metro_cambio", "EstacionMetroCambio", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "estacion_metro_cambio", db: "estacionMetroCambio", type: "TEXT" },
		{ csv: "Campo2", db: "campo2", type: "TEXT" },
	]],
	["estacion_tren", "EstacionTren", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "EstacionTren", db: "estacionTren", type: "TEXT" },
	]],
	["estudios", "Estudios", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Estudios", db: "estudios", type: "TEXT" },
	]],
	["etapa", "Etapa", [
		{ csv: "Hogar", db: "hogar", type: "TEXT" },
		{ csv: "Persona", db: "persona", type: "TEXT" },
		{ csv: "Viaje", db: "viaje", type: "TEXT" },
		{ csv: "Etapa", db: "etapa", type: "TEXT" },
		{ csv: "ZonaOrigen", db: "zonaOrigen", type: "INTEGER" },
		{ csv: "ZonaDestino", db: "zonaDestino", type: "INTEGER" },
		{ csv: "ComunaOrigen", db: "comunaOrigen", type: "INTEGER" },
		{ csv: "ComunaDestino", db: "comunaDestino", type: "INTEGER" },
		{ csv: "OrigenCoordX", db: "origenCoordX", type: "REAL" },
		{ csv: "OrigenCoordY", db: "origenCoordY", type: "REAL" },
		{ csv: "DestinoCoordX", db: "destinoCoordX", type: "REAL" },
		{ csv: "DestinoCoordY", db: "destinoCoordY", type: "REAL" },
		{ csv: "Modo", db: "modo", type: "INTEGER" },
		{ csv: "CuadrasAntes", db: "cuadrasAntes", type: "INTEGER" },
		{ csv: "MinutosAntes", db: "minutosAntes", type: "INTEGER" },
		{ csv: "Autopistas", db: "autopistas", type: "INTEGER" },
		{ csv: "NoUsaAutopistas", db: "noUsaAutopistas", type: "INTEGER" },
		{ csv: "Estaciona", db: "estaciona", type: "TEXT" },
		{ csv: "CostoEstacionamiento", db: "costoEstacionamiento", type: "REAL" },
		{ csv: "FormaPago", db: "formaPago", type: "TEXT" },
		{ csv: "EstacionTrenIni", db: "estacionTrenIni", type: "TEXT" },
		{ csv: "EstacionTrenFin", db: "estacionTrenFin", type: "TEXT" },
		{ csv: "TarifaTren", db: "tarifaTren", type: "REAL" },
		{ csv: "RecorridoTransantiago", db: "recorridoTransantiago", type: "TEXT" },
		{ csv: "TiempoEsperaTstgo", db: "tiempoEsperaTstgo", type: "INTEGER" },
		{ csv: "TiempoEsperaBus", db: "tiempoEsperaBus", type: "INTEGER" },
		{ csv: "BusesPerdidos", db: "busesPerdidos", type: "INTEGER" },
		{ csv: "TarifaBusNoTransantiago", db: "tarifaBusNoTransantiago", type: "REAL" },
		{ csv: "EstacionMetroIni", db: "estacionMetroIni", type: "TEXT" },
		{ csv: "EstacionMetroFin", db: "estacionMetroFin", type: "TEXT" },
		{ csv: "HorarioMetro", db: "horarioMetro", type: "TEXT" },
		{ csv: "MetrosPerdidos", db: "metrosPerdidos", type: "INTEGER" },
		{ csv: "EstacionMetroCambio", db: "estacionMetroCambio", type: "TEXT" },
		{ csv: "RecorridoTxc", db: "recorridoTxc", type: "TEXT" },
		{ csv: "TiempoEsperaTxc", db: "tiempoEsperaTxc", type: "INTEGER" },
		{ csv: "TarifaTxc", db: "tarifaTxc", type: "REAL" },
		{ csv: "TiempoEsperaTaxi", db: "tiempoEsperaTaxi", type: "INTEGER" },
		{ csv: "TarifaTaxi", db: "tarifaTaxi", type: "REAL" },
		{ csv: "PropiedadBicicleta", db: "propiedadBicicleta", type: "INTEGER" },
		{ csv: "UsaCiclovia", db: "usaCiclovia", type: "INTEGER" },
		{ csv: "CirculacionBicicleta", db: "circulacionBicicleta", type: "INTEGER" },
		{ csv: "EstacionaBicicleta", db: "estacionaBicicleta", type: "INTEGER" },
		{ csv: "ModoEstacionaBicicleta", db: "modoEstacionaBicicleta", type: "INTEGER" },
		{ csv: "UsoHabitualBicicleta", db: "usoHabitualBicicleta", type: "INTEGER" },
	]],
	["etapas", "Etapas", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Etapas", db: "etapas", type: "TEXT" },
	]],
	["forma_pago", "FormaPago", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Forma_pago", db: "formaPago", type: "TEXT" },
	]],
	["hogar", "Hogar", [
		{ csv: "Hogar", db: "hogar", type: "TEXT" },
		{ csv: "Sector", db: "sector", type: "INTEGER" },
		{ csv: "Zona", db: "zona", type: "INTEGER" },
		{ csv: "Comuna", db: "comuna", type: "TEXT" },
		{ csv: "DirCoordX", db: "dirCoordX", type: "REAL" },
		{ csv: "DirCoordY", db: "dirCoordY", type: "REAL" },
		{ csv: "Fecha", db: "fecha", type: "TEXT" },
		{ csv: "DiaAsig", db: "diaAsig", type: "TEXT" },
		{ csv: "TipoDia", db: "tipoDia", type: "INTEGER" },
		{ csv: "Temporada", db: "temporada", type: "INTEGER" },
		{ csv: "NumPer", db: "numPer", type: "INTEGER" },
		{ csv: "NumVeh", db: "numVeh", type: "INTEGER" },
		{ csv: "NumBicAdulto", db: "numBicAdulto", type: "INTEGER" },
		{ csv: "NumBicNino", db: "numBicNino", type: "INTEGER" },
		{ csv: "Propiedad", db: "propiedad", type: "INTEGER" },
		{ csv: "MontoDiv", db: "montoDiv", type: "REAL" },
		{ csv: "ImputadoDiv", db: "imputadoDiv", type: "REAL" },
		{ csv: "MontoArr", db: "montoArr", type: "REAL" },
		{ csv: "ImputadoArr", db: "imputadoArr", type: "REAL" },
		{ csv: "IngresoHogar", db: "ingresoHogar", type: "REAL" },
		{ csv: "Factor", db: "factor", type: "REAL" },
	]],
	["horario_metro", "HorarioMetro", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "horario_metro", db: "horarioMetro", type: "TEXT" },
		{ csv: "Campo1", db: "campo1", type: "TEXT" },
	]],
	["ingreso_imputado", "IngresoImputado", [
		{ csv: "ID", db: "id", type: "TEXT" },
		{ csv: "Imputación", db: "imputacion", type: "TEXT" },
	]],
	["jornada_trabajo", "JornadaTrabajo", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "jornada_trabajo", db: "jornadaTrabajo", type: "TEXT" },
	]],
	["licencia_conducir", "LicenciaConducir", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "licencia_conducir", db: "licenciaConducir", type: "TEXT" },
	]],
	["marca_veh", "MarcaVeh", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "MarcaVeh", db: "marcaVeh", type: "TEXT" },
	]],
	["medios_usados", "MediosUsados", [
		{ csv: "MediosUsados", db: "mediosUsados", type: "TEXT" },
	]],
	["medio_viaje_restriccion", "MedioViajeRestriccion", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "medio_viaje", db: "medioViaje", type: "TEXT" },
	]],
	["modo", "Modo", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Modo", db: "modo", type: "TEXT" },
	]],
	["modo_difusion", "ModoDifusion", [
		{ csv: "ID", db: "id", type: "TEXT" },
		{ csv: "ModoDifusion", db: "modoDifusion", type: "TEXT" },
	]],
	["modo_estaciona_bicicleta", "ModoEstacionaBicicleta", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "ModoEstacionaBicicleta", db: "modoEstacionaBicicleta", type: "TEXT" },
	]],
	["modo_motor", "ModoMotor", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "ModoMotor", db: "modoMotor", type: "TEXT" },
	]],
	["modo_pri_pub", "ModoPriPub", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "ModoPriPub", db: "modoPriPub", type: "TEXT" },
	]],
	["no_usa_autopista", "NoUsaAutopista", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "no_usa_autopista", db: "noUsaAutopista", type: "TEXT" },
		{ csv: "Campo2", db: "campo2", type: "TEXT" },
	]],
	["no_usa_transantiago", "NoUsaTransantiago", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "No_usa_transantiago", db: "noUsaTransantiago", type: "TEXT" },
	]],
	["no_viaja", "NoViaja", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "No_viaja", db: "noViaja", type: "TEXT" },
	]],
	["ocupacion", "Ocupación", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "ocupacion", db: "ocupacion", type: "TEXT" },
	]],
	["pase_escolar", "PaseEscolar", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "PaseEscolar", db: "paseEscolar", type: "TEXT" },
	]],
	["periodo", "Periodo", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Periodos", db: "periodos", type: "TEXT" },
	]],
	["persona", "Persona", [
		{ csv: "Hogar", db: "hogar", type: "TEXT" },
		{ csv: "Persona", db: "persona", type: "TEXT" },
		{ csv: "AnoNac", db: "anoNac", type: "INTEGER" },
		{ csv: "Sexo", db: "sexo", type: "INTEGER" },
		{ csv: "Relacion", db: "relacion", type: "INTEGER" },
		{ csv: "Viajes", db: "viajes", type: "INTEGER" },
		{ csv: "LicenciaConducir", db: "licenciaConducir", type: "TEXT" },
		{ csv: "PaseEscolar", db: "paseEscolar", type: "INTEGER" },
		{ csv: "AdultoMayor", db: "adultoMayor", type: "INTEGER" },
		{ csv: "Estudios", db: "estudios", type: "INTEGER" },
		{ csv: "Curso", db: "curso", type: "INTEGER" },
		{ csv: "Actividad", db: "actividad", type: "TEXT" },
		{ csv: "Ocupacion", db: "ocupacion", type: "INTEGER" },
		{ csv: "ActividadEmpresa", db: "actividadEmpresa", type: "INTEGER" },
		{ csv: "JornadaTrabajo", db: "jornadaTrabajo", type: "INTEGER" },
		{ csv: "DondeEstudia", db: "dondeEstudia", type: "TEXT" },
		{ csv: "DirActividadCoordX", db: "dirActividadCoordX", type: "REAL" },
		{ csv: "DirActividadCoordY", db: "dirActividadCoordY", type: "REAL" },
		{ csv: "DirEstudiosCoordX", db: "dirEstudiosCoordX", type: "REAL" },
		{ csv: "DirEstudiosCoordY", db: "dirEstudiosCoordY", type: "REAL" },
		{ csv: "NoViaja", db: "noViaja", type: "INTEGER" },
		{ csv: "TarjetaBip", db: "tarjetaBip", type: "TEXT" },
		{ csv: "Tarjeta2Bip", db: "tarjeta2Bip", type: "TEXT" },
		{ csv: "MedioViajeRestricion", db: "medioViajeRestricion", type: "TEXT" },
		{ csv: "ConoceTransantiago", db: "conoceTransantiago", type: "TEXT" },
		{ csv: "NoUsaTransantiago", db: "noUsaTransantiago", type: "TEXT" },
		{ csv: "Discapacidad", db: "discapacidad", type: "INTEGER" },
		{ csv: "TieneIngresos", db: "tieneIngresos", type: "INTEGER" },
		{ csv: "Ingreso", db: "ingreso", type: "REAL" },
		{ csv: "TramoIngreso", db: "tramoIngreso", type: "INTEGER" },
		{ csv: "IngresoFinal", db: "ingresoFinal", type: "REAL" },
		{ csv: "TramoIngresoFinal", db: "tramoIngresoFinal", type: "INTEGER" },
		{ csv: "IngresoImputado", db: "ingresoImputado", type: "TEXT" },
		{ csv: "Factor_LaboralNormal", db: "factorLaboralNormal", type: "REAL" },
		{ csv: "Factor_SábadoNormal", db: "factorSabadoNormal", type: "REAL" },
		{ csv: "Factor_DomingoNormal", db: "factorDomingoNormal", type: "REAL" },
		{ csv: "Factor_LaboralEstival", db: "factorLaboralEstival", type: "REAL" },
		{ csv: "Factor_FindesemanaEstival", db: "factorFindesemanaEstival", type: "REAL" },
		{ csv: "Factor", db: "factor", type: "REAL" },
	]],
	["propieda_bicicleta", "PropiedaBicicleta", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "propiedad_bicicleta", db: "propiedadBicicleta", type: "TEXT" },
	]],
	["propiedad", "Propiedad", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Propiedad", db: "propiedad", type: "TEXT" },
	]],
	["propiedad_vehiculo", "PropiedadVehiculo", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Propiedad_vehiculo", db: "propiedadVehiculo", type: "TEXT" },
	]],
	["proposito", "Proposito", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Proposito", db: "proposito", type: "TEXT" },
	]],
	["proposito_agregado", "PropositoAgregado", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "PropositoEstraus", db: "propositoEstraus", type: "TEXT" },
	]],
	["recorrido_transantiago", "RecorridoTransantiago", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "RecorridoTransantiago", db: "recorridoTransantiago", type: "TEXT" },
	]],
	["relacion", "Relacion", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "relacion", db: "relacion", type: "TEXT" },
	]],
	["sector", "Sector", [
		{ csv: "Sector", db: "sector", type: "TEXT" },
		{ csv: "Nombre", db: "nombre", type: "TEXT" },
	]],
	["sello_verde", "SelloVerde", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "sello_verde", db: "selloVerde", type: "TEXT" },
	]],
	["sexo", "Sexo", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Sexo", db: "sexo", type: "TEXT" },
	]],
	["sexo_viaje", "SexoViaje", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Sexo", db: "sexo", type: "TEXT" },
	]],
	["temporada", "Temporada", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Temporada", db: "temporada", type: "TEXT" },
	]],
	["tiempo_medio", "TiempoMedio", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "TiempoMedio", db: "tiempoMedio", type: "TEXT" },
	]],
	["tiene_ingresos", "Tiene_ingresos", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "tiene_ingresos", db: "tieneIngresos", type: "TEXT" },
	]],
	["tipo_dia", "TipoDia", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "TipoDia", db: "tipoDia", type: "TEXT" },
	]],
	["tipo_veh", "TipoVeh", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "vehículo", db: "vehiculo", type: "TEXT" },
	]],
	["tramo_ingreso", "TramoIngreso", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "TramoIngreso", db: "tramoIngreso", type: "TEXT" },
	]],
	["usa_ciclovia", "UsaCiclovia", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "Usa Ciclovía", db: "usaCiclovia", type: "TEXT" },
	]],
	["uso_habitual_bicicleta", "UsoHabitualBicicleta", [
		{ csv: "Id", db: "id", type: "TEXT" },
		{ csv: "uso_habitual_bicicleta", db: "usoHabitualBicicleta", type: "TEXT" },
	]],
	["vehiculo", "Vehiculo", [
		{ csv: "Hogar", db: "hogar", type: "TEXT" },
		{ csv: "Vehiculo", db: "vehiculo", type: "TEXT" },
		{ csv: "TipoVeh", db: "tipoVeh", type: "INTEGER" },
		{ csv: "MarcaVeh", db: "marcaVeh", type: "INTEGER" },
		{ csv: "ModeloVeh", db: "modeloVeh", type: "TEXT" },
		{ csv: "AnoVeh", db: "anoVeh", type: "INTEGER" },
		{ csv: "EdadVehiculo", db: "edadVehiculo", type: "INTEGER" },
		{ csv: "CilindradaVeh", db: "cilindradaVeh", type: "INTEGER" },
		{ csv: "Combustible", db: "combustible", type: "INTEGER" },
		{ csv: "SelloVerde", db: "selloVerde", type: "INTEGER" },
		{ csv: "Propiedad", db: "propiedad", type: "INTEGER" },
	]],
	["viaje", "Viaje", [
		{ csv: "Hogar", db: "hogar", type: "TEXT" },
		{ csv: "Persona", db: "persona", type: "TEXT" },
		{ csv: "Viaje", db: "viaje", type: "TEXT" },
		{ csv: "Etapas", db: "etapas", type: "INTEGER" },
		{ csv: "ComunaOrigen", db: "comunaOrigen", type: "INTEGER" },
		{ csv: "ComunaDestino", db: "comunaDestino", type: "INTEGER" },
		{ csv: "SectorOrigen", db: "sectorOrigen", type: "INTEGER" },
		{ csv: "SectorDestino", db: "sectorDestino", type: "INTEGER" },
		{ csv: "ZonaOrigen", db: "zonaOrigen", type: "INTEGER" },
		{ csv: "ZonaDestino", db: "zonaDestino", type: "INTEGER" },
		{ csv: "OrigenCoordX", db: "origenCoordX", type: "REAL" },
		{ csv: "OrigenCoordY", db: "origenCoordY", type: "REAL" },
		{ csv: "DestinoCoordX", db: "destinoCoordX", type: "REAL" },
		{ csv: "DestinoCoordY", db: "destinoCoordY", type: "REAL" },
		{ csv: "Proposito", db: "proposito", type: "INTEGER" },
		{ csv: "PropositoAgregado", db: "propositoAgregado", type: "INTEGER" },
		{ csv: "ActividadDestino", db: "actividadDestino", type: "TEXT" },
		{ csv: "MediosUsados", db: "mediosUsados", type: "TEXT" },
		{ csv: "ModoAgregado", db: "modoAgregado", type: "TEXT" },
		{ csv: "ModoPriPub", db: "modoPriPub", type: "INTEGER" },
		{ csv: "ModoMotor", db: "modoMotor", type: "INTEGER" },
		{ csv: "HoraIni", db: "horaIni", type: "TEXT" },
		{ csv: "HoraFin", db: "horaFin", type: "TEXT" },
		{ csv: "HoraMedia", db: "horaMedia", type: "TEXT" },
		{ csv: "TiempoViaje", db: "tiempoViaje", type: "INTEGER" },
		{ csv: "TiempoMedio", db: "tiempoMedio", type: "INTEGER" },
		{ csv: "Periodo", db: "periodo", type: "INTEGER" },
		{ csv: "MinutosDespues", db: "minutosDespues", type: "INTEGER" },
		{ csv: "CuadrasDespues", db: "cuadrasDespues", type: "INTEGER" },
		{ csv: "FactorLaboralNormal", db: "factorLaboralNormal", type: "REAL" },
		{ csv: "FactorSabadoNormal", db: "factorSabadoNormal", type: "REAL" },
		{ csv: "FactorDomingoNormal", db: "factorDomingoNormal", type: "REAL" },
		{ csv: "FactorLaboralEstival", db: "factorLaboralEstival", type: "REAL" },
		{ csv: "FactorFindesemanaEstival", db: "factorFindesemanaEstival", type: "REAL" },
		{ csv: "CódigoTiempo", db: "codigoTiempo", type: "INTEGER" },
	]],
	["viajes_difusion", "ViajesDifusion", [
		{ csv: "Viaje", db: "viaje", type: "TEXT" },
		{ csv: "ModoDifusion", db: "modoDifusion", type: "TEXT" },
	]],
];

const csvDir = resolve("csv_export");

out.write("PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;\n");
log("Starting EOD CSV → SQL dump (camelCase mapping)...");
for (const [tableName, fileName, mappings] of tables) {
	const csvPath = resolve(csvDir, `${fileName}.csv`);
	const content = readFileSync(csvPath, "utf-8");
	const lines = content.split("\n").filter((line) => line.trim() !== "");

	if (lines.length < 2) {
		log(`${tableName}: empty table, skipping`);
		continue;
	}

	const headerLine = lines[0];
	if (headerLine === undefined) {
		log(`${tableName}: empty table, skipping`);
		continue;
	}
	const csvHeaders = headerLine.split(",").map((h) => h.trim());
	const columnIndexMap: Record<string, number> = {};
	csvHeaders.forEach((h, idx) => {
		columnIndexMap[h] = idx;
	});

	const dbCols = mappings.map((m) => `"${m.db}"`).join(",");
	const insertPrefix = `INSERT INTO "${tableName}" (${dbCols}) VALUES `;

	const rows = lines.slice(1);
	const batchSize = 500;
	let written = 0;

	for (let i = 0; i < rows.length; i += batchSize) {
		const tuples: string[] = [];
		for (const line of rows.slice(i, i + batchSize)) {
			const values = parseCSVLine(line);
			const parsed = mappings.map((m) => {
				const idx = columnIndexMap[m.csv];
				if (idx === undefined) return null;
				return parseValue(values[idx] ?? "", m.type);
			});
			tuples.push(`(${parsed.map(sqlEscape).join(",")})`);
		}
		out.write(`${insertPrefix}${tuples.join(",")};\n`);
		written += tuples.length;
	}

	log(`${tableName}: ${written} rows`);
}
out.write("COMMIT;\n");
log("Done!");
if (out !== process.stdout) (out as ReturnType<typeof createWriteStream>).end();
