import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const actividad = sqliteTable("actividad", {
	id: text().primaryKey(),
	actividad: text(),
});

export const actividadDestino = sqliteTable("actividad_destino", {
	id: text().primaryKey(),
	actividadDestino: text(),
});

export const actividadEmpresa = sqliteTable("actividad_empresa", {
	id: text().primaryKey(),
	actividadEmpresa: text(),
});

export const adultoMayor = sqliteTable("adulto_mayor", {
	id: text().primaryKey(),
	adultoMayor: text(),
});

export const autopista = sqliteTable("autopista", {
	id: text().primaryKey(),
	autopista: text(),
	campo2: text(),
});

export const circulacionBicicleta = sqliteTable("circulacion_bicicleta", {
	id: text().primaryKey(),
	circulacionBicicleta: text(),
});

export const codigoTiempo = sqliteTable("codigo_tiempo", {
	codigo: text().primaryKey(),
	observacion: text(),
});

export const combustible = sqliteTable("combustible", {
	id: text().primaryKey(),
	combustible: text(),
});

export const comuna = sqliteTable("comuna", {
	id: text().primaryKey(),
	comuna: text(),
});

export const conoceTransantiago = sqliteTable("conoce_transantiago", {
	id: text().primaryKey(),
	conoceTransantiago: text(),
});

export const discapacidad = sqliteTable("discapacidad", {
	id: text().primaryKey(),
	discapacidad: text(),
});

export const distanciaViaje = sqliteTable("distancia_viaje", {
	viaje: text().primaryKey(),
	distEuclidiana: real(),
	distManhattan: real(),
	imputada: real(),
});

export const dondeEstudia = sqliteTable("donde_estudia", {
	id: text().primaryKey(),
	dondeEstudia: text(),
});

export const edadPersonas = sqliteTable("edad_personas", {
	persona: text().primaryKey(),
	edad: integer(),
});

export const edadVehiculo = sqliteTable("edad_vehiculo", {
	id: text().primaryKey(),
	edadVehiculo: text(),
});

export const estaciona = sqliteTable("estaciona", {
	id: text().primaryKey(),
	estaciona: text(),
});

export const estacionaBicicleta = sqliteTable("estaciona_bicicleta", {
	id: text().primaryKey(),
	campo1: text(),
});

export const estacionMetro = sqliteTable("estacion_metro", {
	id: text().primaryKey(),
	estacionMetro: text(),
});

export const estacionMetroCambio = sqliteTable("estacion_metro_cambio", {
	id: text().primaryKey(),
	estacionMetroCambio: text(),
	campo2: text(),
});

export const estacionTren = sqliteTable("estacion_tren", {
	id: text().primaryKey(),
	estacionTren: text(),
});

export const estudios = sqliteTable("estudios", {
	id: text().primaryKey(),
	estudios: text(),
});

export const etapa = sqliteTable("etapa", {
	hogar: text(),
	persona: text(),
	viaje: text(),
	etapa: text(),
	zonaOrigen: integer(),
	zonaDestino: integer(),
	comunaOrigen: integer(),
	comunaDestino: integer(),
	origenCoordX: real(),
	origenCoordY: real(),
	destinoCoordX: real(),
	destinoCoordY: real(),
	modo: integer(),
	cuadrasAntes: integer(),
	minutosAntes: integer(),
	autopistas: integer(),
	noUsaAutopistas: integer(),
	estaciona: text(),
	costoEstacionamiento: real(),
	formaPago: text(),
	estacionTrenIni: text(),
	estacionTrenFin: text(),
	tarifaTren: real(),
	recorridoTransantiago: text(),
	tiempoEsperaTstgo: integer(),
	tiempoEsperaBus: integer(),
	busesPerdidos: integer(),
	tarifaBusNoTransantiago: real(),
	estacionMetroIni: text(),
	estacionMetroFin: text(),
	horarioMetro: text(),
	metrosPerdidos: integer(),
	estacionMetroCambio: text(),
	recorridoTxc: text(),
	tiempoEsperaTxc: integer(),
	tarifaTxc: real(),
	tiempoEsperaTaxi: integer(),
	tarifaTaxi: real(),
	propiedadBicicleta: integer(),
	usaCiclovia: integer(),
	circulacionBicicleta: integer(),
	estacionaBicicleta: integer(),
	modoEstacionaBicicleta: integer(),
	usoHabitualBicicleta: integer(),
});

export const etapas = sqliteTable("etapas", {
	id: text().primaryKey(),
	etapas: text(),
});

export const formaPago = sqliteTable("forma_pago", {
	id: text().primaryKey(),
	formaPago: text(),
});

export const hogar = sqliteTable("hogar", {
	hogar: text().primaryKey(),
	sector: integer(),
	zona: integer(),
	comuna: text(),
	dirCoordX: real(),
	dirCoordY: real(),
	fecha: text(),
	diaAsig: text(),
	tipoDia: integer(),
	temporada: integer(),
	numPer: integer(),
	numVeh: integer(),
	numBicAdulto: integer(),
	numBicNino: integer(),
	propiedad: integer(),
	montoDiv: real(),
	imputadoDiv: real(),
	montoArr: real(),
	imputadoArr: real(),
	ingresoHogar: real(),
	factor: real(),
});

export const horarioMetro = sqliteTable("horario_metro", {
	id: text().primaryKey(),
	horarioMetro: text(),
	campo1: text(),
});

export const ingresoImputado = sqliteTable("ingreso_imputado", {
	id: text().primaryKey(),
	imputacion: text(),
});

export const jornadaTrabajo = sqliteTable("jornada_trabajo", {
	id: text().primaryKey(),
	jornadaTrabajo: text(),
});

export const licenciaConducir = sqliteTable("licencia_conducir", {
	id: text().primaryKey(),
	licenciaConducir: text(),
});

export const marcaVeh = sqliteTable("marca_veh", {
	id: text().primaryKey(),
	marcaVeh: text(),
});

export const mediosUsados = sqliteTable("medios_usados", {
	mediosUsados: text().primaryKey(),
});

export const medioViajeRestriccion = sqliteTable("medio_viaje_restriccion", {
	id: text().primaryKey(),
	medioViaje: text(),
});

export const modo = sqliteTable("modo", {
	id: text().primaryKey(),
	modo: text(),
});

export const modoDifusion = sqliteTable("modo_difusion", {
	id: text().primaryKey(),
	modoDifusion: text(),
});

export const modoEstacionaBicicleta = sqliteTable("modo_estaciona_bicicleta", {
	id: text().primaryKey(),
	modoEstacionaBicicleta: text(),
});

export const modoMotor = sqliteTable("modo_motor", {
	id: text().primaryKey(),
	modoMotor: text(),
});

export const modoPriPub = sqliteTable("modo_pri_pub", {
	id: text().primaryKey(),
	modoPriPub: text(),
});

export const noUsaAutopista = sqliteTable("no_usa_autopista", {
	id: text().primaryKey(),
	noUsaAutopista: text(),
	campo2: text(),
});

export const noUsaTransantiago = sqliteTable("no_usa_transantiago", {
	id: text().primaryKey(),
	noUsaTransantiago: text(),
});

export const noViaja = sqliteTable("no_viaja", {
	id: text().primaryKey(),
	noViaja: text(),
});

export const ocupacion = sqliteTable("ocupacion", {
	id: text().primaryKey(),
	ocupacion: text(),
});

export const paseEscolar = sqliteTable("pase_escolar", {
	id: text().primaryKey(),
	paseEscolar: text(),
});

export const periodo = sqliteTable("periodo", {
	id: text().primaryKey(),
	periodos: text(),
});

export const persona = sqliteTable("persona", {
	hogar: text(),
	persona: text().primaryKey(),
	anoNac: integer(),
	sexo: integer(),
	relacion: integer(),
	viajes: integer(),
	licenciaConducir: text(),
	paseEscolar: integer(),
	adultoMayor: integer(),
	estudios: integer(),
	curso: integer(),
	actividad: text(),
	ocupacion: integer(),
	actividadEmpresa: integer(),
	jornadaTrabajo: integer(),
	dondeEstudia: text(),
	dirActividadCoordX: real(),
	dirActividadCoordY: real(),
	dirEstudiosCoordX: real(),
	dirEstudiosCoordY: real(),
	noViaja: integer(),
	tarjetaBip: text(),
	tarjeta2Bip: text(),
	medioViajeRestricion: text(),
	conoceTransantiago: text(),
	noUsaTransantiago: text(),
	discapacidad: integer(),
	tieneIngresos: integer(),
	ingreso: real(),
	tramoIngreso: integer(),
	ingresoFinal: real(),
	tramoIngresoFinal: integer(),
	ingresoImputado: text(),
	factorLaboralNormal: real(),
	factorSabadoNormal: real(),
	factorDomingoNormal: real(),
	factorLaboralEstival: real(),
	factorFindesemanaEstival: real(),
	factor: real(),
});

export const propiedaBicicleta = sqliteTable("propieda_bicicleta", {
	id: text().primaryKey(),
	propiedadBicicleta: text(),
});

export const propiedad = sqliteTable("propiedad", {
	id: text().primaryKey(),
	propiedad: text(),
});

export const propiedadVehiculo = sqliteTable("propiedad_vehiculo", {
	id: text().primaryKey(),
	propiedadVehiculo: text(),
});

export const proposito = sqliteTable("proposito", {
	id: text().primaryKey(),
	proposito: text(),
});

export const propositoAgregado = sqliteTable("proposito_agregado", {
	id: text().primaryKey(),
	propositoEstraus: text(),
});

export const recorridoTransantiago = sqliteTable("recorrido_transantiago", {
	id: text().primaryKey(),
	recorridoTransantiago: text(),
});

export const relacion = sqliteTable("relacion", {
	id: text().primaryKey(),
	relacion: text(),
});

export const sector = sqliteTable("sector", {
	sector: text().primaryKey(),
	nombre: text(),
});

export const selloVerde = sqliteTable("sello_verde", {
	id: text().primaryKey(),
	selloVerde: text(),
});

export const sexo = sqliteTable("sexo", {
	id: text().primaryKey(),
	sexo: text(),
});

export const sexoViaje = sqliteTable("sexo_viaje", {
	id: text().primaryKey(),
	sexo: text(),
});

export const temporada = sqliteTable("temporada", {
	id: text().primaryKey(),
	temporada: text(),
});

export const tiempoMedio = sqliteTable("tiempo_medio", {
	id: text().primaryKey(),
	tiempoMedio: text(),
});

export const tieneIngresos = sqliteTable("tiene_ingresos", {
	id: text().primaryKey(),
	tieneIngresos: text(),
});

export const tipoDia = sqliteTable("tipo_dia", {
	id: text().primaryKey(),
	tipoDia: text(),
});

export const tipoVeh = sqliteTable("tipo_veh", {
	id: text().primaryKey(),
	vehiculo: text(),
});

export const tramoIngreso = sqliteTable("tramo_ingreso", {
	id: text().primaryKey(),
	tramoIngreso: text(),
});

export const usaCiclovia = sqliteTable("usa_ciclovia", {
	id: text().primaryKey(),
	usaCiclovia: text(),
});

export const usoHabitualBicicleta = sqliteTable("uso_habitual_bicicleta", {
	id: text().primaryKey(),
	usoHabitualBicicleta: text(),
});

export const vehiculo = sqliteTable("vehiculo", {
	hogar: text(),
	vehiculo: text().primaryKey(),
	tipoVeh: integer(),
	marcaVeh: integer(),
	modeloVeh: text(),
	anoVeh: integer(),
	edadVehiculo: integer(),
	cilindradaVeh: integer(),
	combustible: integer(),
	selloVerde: integer(),
	propiedad: integer(),
});

export const viaje = sqliteTable("viaje", {
	hogar: text(),
	persona: text(),
	viaje: text().primaryKey(),
	etapas: integer(),
	comunaOrigen: integer(),
	comunaDestino: integer(),
	sectorOrigen: integer(),
	sectorDestino: integer(),
	zonaOrigen: integer(),
	zonaDestino: integer(),
	origenCoordX: real(),
	origenCoordY: real(),
	destinoCoordX: real(),
	destinoCoordY: real(),
	proposito: integer(),
	propositoAgregado: integer(),
	actividadDestino: text(),
	mediosUsados: text(),
	modoAgregado: text(),
	modoPriPub: integer(),
	modoMotor: integer(),
	horaIni: text(),
	horaFin: text(),
	horaMedia: text(),
	tiempoViaje: integer(),
	tiempoMedio: integer(),
	periodo: integer(),
	minutosDespues: integer(),
	cuadrasDespues: integer(),
	factorLaboralNormal: real(),
	factorSabadoNormal: real(),
	factorDomingoNormal: real(),
	factorLaboralEstival: real(),
	factorFindesemanaEstival: real(),
	codigoTiempo: integer(),
});

export const viajesDifusion = sqliteTable("viajes_difusion", {
	viaje: text().primaryKey(),
	modoDifusion: text(),
});
