CREATE TABLE `todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `actividad` (
	`id` text PRIMARY KEY NOT NULL,
	`actividad` text
);
--> statement-breakpoint
CREATE TABLE `actividad_destino` (
	`id` text PRIMARY KEY NOT NULL,
	`actividadDestino` text
);
--> statement-breakpoint
CREATE TABLE `actividad_empresa` (
	`id` text PRIMARY KEY NOT NULL,
	`actividadEmpresa` text
);
--> statement-breakpoint
CREATE TABLE `adulto_mayor` (
	`id` text PRIMARY KEY NOT NULL,
	`adultoMayor` text
);
--> statement-breakpoint
CREATE TABLE `autopista` (
	`id` text PRIMARY KEY NOT NULL,
	`autopista` text,
	`campo2` text
);
--> statement-breakpoint
CREATE TABLE `circulacion_bicicleta` (
	`id` text PRIMARY KEY NOT NULL,
	`circulacionBicicleta` text
);
--> statement-breakpoint
CREATE TABLE `codigo_tiempo` (
	`codigo` text PRIMARY KEY NOT NULL,
	`observacion` text
);
--> statement-breakpoint
CREATE TABLE `combustible` (
	`id` text PRIMARY KEY NOT NULL,
	`combustible` text
);
--> statement-breakpoint
CREATE TABLE `comuna` (
	`id` text PRIMARY KEY NOT NULL,
	`comuna` text
);
--> statement-breakpoint
CREATE TABLE `conoce_transantiago` (
	`id` text PRIMARY KEY NOT NULL,
	`conoceTransantiago` text
);
--> statement-breakpoint
CREATE TABLE `discapacidad` (
	`id` text PRIMARY KEY NOT NULL,
	`discapacidad` text
);
--> statement-breakpoint
CREATE TABLE `distancia_viaje` (
	`viaje` text PRIMARY KEY NOT NULL,
	`distEuclidiana` real,
	`distManhattan` real,
	`imputada` real
);
--> statement-breakpoint
CREATE TABLE `donde_estudia` (
	`id` text PRIMARY KEY NOT NULL,
	`dondeEstudia` text
);
--> statement-breakpoint
CREATE TABLE `edad_personas` (
	`persona` text PRIMARY KEY NOT NULL,
	`edad` integer
);
--> statement-breakpoint
CREATE TABLE `edad_vehiculo` (
	`id` text PRIMARY KEY NOT NULL,
	`edadVehiculo` text
);
--> statement-breakpoint
CREATE TABLE `estacion_metro` (
	`id` text PRIMARY KEY NOT NULL,
	`estacionMetro` text
);
--> statement-breakpoint
CREATE TABLE `estacion_metro_cambio` (
	`id` text PRIMARY KEY NOT NULL,
	`estacionMetroCambio` text,
	`campo2` text
);
--> statement-breakpoint
CREATE TABLE `estacion_tren` (
	`id` text PRIMARY KEY NOT NULL,
	`estacionTren` text
);
--> statement-breakpoint
CREATE TABLE `estaciona` (
	`id` text PRIMARY KEY NOT NULL,
	`estaciona` text
);
--> statement-breakpoint
CREATE TABLE `estaciona_bicicleta` (
	`id` text PRIMARY KEY NOT NULL,
	`campo1` text
);
--> statement-breakpoint
CREATE TABLE `estudios` (
	`id` text PRIMARY KEY NOT NULL,
	`estudios` text
);
--> statement-breakpoint
CREATE TABLE `etapa` (
	`hogar` text,
	`persona` text,
	`viaje` text,
	`etapa` text,
	`zonaOrigen` integer,
	`zonaDestino` integer,
	`comunaOrigen` integer,
	`comunaDestino` integer,
	`origenCoordX` real,
	`origenCoordY` real,
	`destinoCoordX` real,
	`destinoCoordY` real,
	`modo` integer,
	`cuadrasAntes` integer,
	`minutosAntes` integer,
	`autopistas` integer,
	`noUsaAutopistas` integer,
	`estaciona` text,
	`costoEstacionamiento` real,
	`formaPago` text,
	`estacionTrenIni` text,
	`estacionTrenFin` text,
	`tarifaTren` real,
	`recorridoTransantiago` text,
	`tiempoEsperaTstgo` integer,
	`tiempoEsperaBus` integer,
	`busesPerdidos` integer,
	`tarifaBusNoTransantiago` real,
	`estacionMetroIni` text,
	`estacionMetroFin` text,
	`horarioMetro` text,
	`metrosPerdidos` integer,
	`estacionMetroCambio` text,
	`recorridoTxc` text,
	`tiempoEsperaTxc` integer,
	`tarifaTxc` real,
	`tiempoEsperaTaxi` integer,
	`tarifaTaxi` real,
	`propiedadBicicleta` integer,
	`usaCiclovia` integer,
	`circulacionBicicleta` integer,
	`estacionaBicicleta` integer,
	`modoEstacionaBicicleta` integer,
	`usoHabitualBicicleta` integer
);
--> statement-breakpoint
CREATE TABLE `etapas` (
	`id` text PRIMARY KEY NOT NULL,
	`etapas` text
);
--> statement-breakpoint
CREATE TABLE `forma_pago` (
	`id` text PRIMARY KEY NOT NULL,
	`formaPago` text
);
--> statement-breakpoint
CREATE TABLE `hogar` (
	`hogar` text PRIMARY KEY NOT NULL,
	`sector` integer,
	`zona` integer,
	`comuna` text,
	`dirCoordX` real,
	`dirCoordY` real,
	`fecha` text,
	`diaAsig` text,
	`tipoDia` integer,
	`temporada` integer,
	`numPer` integer,
	`numVeh` integer,
	`numBicAdulto` integer,
	`numBicNino` integer,
	`propiedad` integer,
	`montoDiv` real,
	`imputadoDiv` real,
	`montoArr` real,
	`imputadoArr` real,
	`ingresoHogar` real,
	`factor` real
);
--> statement-breakpoint
CREATE TABLE `horario_metro` (
	`id` text PRIMARY KEY NOT NULL,
	`horarioMetro` text,
	`campo1` text
);
--> statement-breakpoint
CREATE TABLE `ingreso_imputado` (
	`id` text PRIMARY KEY NOT NULL,
	`imputacion` text
);
--> statement-breakpoint
CREATE TABLE `jornada_trabajo` (
	`id` text PRIMARY KEY NOT NULL,
	`jornadaTrabajo` text
);
--> statement-breakpoint
CREATE TABLE `licencia_conducir` (
	`id` text PRIMARY KEY NOT NULL,
	`licenciaConducir` text
);
--> statement-breakpoint
CREATE TABLE `marca_veh` (
	`id` text PRIMARY KEY NOT NULL,
	`marcaVeh` text
);
--> statement-breakpoint
CREATE TABLE `medio_viaje_restriccion` (
	`id` text PRIMARY KEY NOT NULL,
	`medioViaje` text
);
--> statement-breakpoint
CREATE TABLE `medios_usados` (
	`mediosUsados` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `modo` (
	`id` text PRIMARY KEY NOT NULL,
	`modo` text
);
--> statement-breakpoint
CREATE TABLE `modo_difusion` (
	`id` text PRIMARY KEY NOT NULL,
	`modoDifusion` text
);
--> statement-breakpoint
CREATE TABLE `modo_estaciona_bicicleta` (
	`id` text PRIMARY KEY NOT NULL,
	`modoEstacionaBicicleta` text
);
--> statement-breakpoint
CREATE TABLE `modo_motor` (
	`id` text PRIMARY KEY NOT NULL,
	`modoMotor` text
);
--> statement-breakpoint
CREATE TABLE `modo_pri_pub` (
	`id` text PRIMARY KEY NOT NULL,
	`modoPriPub` text
);
--> statement-breakpoint
CREATE TABLE `no_usa_autopista` (
	`id` text PRIMARY KEY NOT NULL,
	`noUsaAutopista` text,
	`campo2` text
);
--> statement-breakpoint
CREATE TABLE `no_usa_transantiago` (
	`id` text PRIMARY KEY NOT NULL,
	`noUsaTransantiago` text
);
--> statement-breakpoint
CREATE TABLE `no_viaja` (
	`id` text PRIMARY KEY NOT NULL,
	`noViaja` text
);
--> statement-breakpoint
CREATE TABLE `ocupacion` (
	`id` text PRIMARY KEY NOT NULL,
	`ocupacion` text
);
--> statement-breakpoint
CREATE TABLE `pase_escolar` (
	`id` text PRIMARY KEY NOT NULL,
	`paseEscolar` text
);
--> statement-breakpoint
CREATE TABLE `periodo` (
	`id` text PRIMARY KEY NOT NULL,
	`periodos` text
);
--> statement-breakpoint
CREATE TABLE `persona` (
	`hogar` text,
	`persona` text PRIMARY KEY NOT NULL,
	`anoNac` integer,
	`sexo` integer,
	`relacion` integer,
	`viajes` integer,
	`licenciaConducir` text,
	`paseEscolar` integer,
	`adultoMayor` integer,
	`estudios` integer,
	`curso` integer,
	`actividad` text,
	`ocupacion` integer,
	`actividadEmpresa` integer,
	`jornadaTrabajo` integer,
	`dondeEstudia` text,
	`dirActividadCoordX` real,
	`dirActividadCoordY` real,
	`dirEstudiosCoordX` real,
	`dirEstudiosCoordY` real,
	`noViaja` integer,
	`tarjetaBip` text,
	`tarjeta2Bip` text,
	`medioViajeRestricion` text,
	`conoceTransantiago` text,
	`noUsaTransantiago` text,
	`discapacidad` integer,
	`tieneIngresos` integer,
	`ingreso` real,
	`tramoIngreso` integer,
	`ingresoFinal` real,
	`tramoIngresoFinal` integer,
	`ingresoImputado` text,
	`factorLaboralNormal` real,
	`factorSabadoNormal` real,
	`factorDomingoNormal` real,
	`factorLaboralEstival` real,
	`factorFindesemanaEstival` real,
	`factor` real
);
--> statement-breakpoint
CREATE TABLE `propieda_bicicleta` (
	`id` text PRIMARY KEY NOT NULL,
	`propiedadBicicleta` text
);
--> statement-breakpoint
CREATE TABLE `propiedad` (
	`id` text PRIMARY KEY NOT NULL,
	`propiedad` text
);
--> statement-breakpoint
CREATE TABLE `propiedad_vehiculo` (
	`id` text PRIMARY KEY NOT NULL,
	`propiedadVehiculo` text
);
--> statement-breakpoint
CREATE TABLE `proposito` (
	`id` text PRIMARY KEY NOT NULL,
	`proposito` text
);
--> statement-breakpoint
CREATE TABLE `proposito_agregado` (
	`id` text PRIMARY KEY NOT NULL,
	`propositoEstraus` text
);
--> statement-breakpoint
CREATE TABLE `recorrido_transantiago` (
	`id` text PRIMARY KEY NOT NULL,
	`recorridoTransantiago` text
);
--> statement-breakpoint
CREATE TABLE `relacion` (
	`id` text PRIMARY KEY NOT NULL,
	`relacion` text
);
--> statement-breakpoint
CREATE TABLE `sector` (
	`sector` text PRIMARY KEY NOT NULL,
	`nombre` text
);
--> statement-breakpoint
CREATE TABLE `sello_verde` (
	`id` text PRIMARY KEY NOT NULL,
	`selloVerde` text
);
--> statement-breakpoint
CREATE TABLE `sexo` (
	`id` text PRIMARY KEY NOT NULL,
	`sexo` text
);
--> statement-breakpoint
CREATE TABLE `sexo_viaje` (
	`id` text PRIMARY KEY NOT NULL,
	`sexo` text
);
--> statement-breakpoint
CREATE TABLE `temporada` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada` text
);
--> statement-breakpoint
CREATE TABLE `tiempo_medio` (
	`id` text PRIMARY KEY NOT NULL,
	`tiempoMedio` text
);
--> statement-breakpoint
CREATE TABLE `tiene_ingresos` (
	`id` text PRIMARY KEY NOT NULL,
	`tieneIngresos` text
);
--> statement-breakpoint
CREATE TABLE `tipo_dia` (
	`id` text PRIMARY KEY NOT NULL,
	`tipoDia` text
);
--> statement-breakpoint
CREATE TABLE `tipo_veh` (
	`id` text PRIMARY KEY NOT NULL,
	`vehiculo` text
);
--> statement-breakpoint
CREATE TABLE `tramo_ingreso` (
	`id` text PRIMARY KEY NOT NULL,
	`tramoIngreso` text
);
--> statement-breakpoint
CREATE TABLE `usa_ciclovia` (
	`id` text PRIMARY KEY NOT NULL,
	`usaCiclovia` text
);
--> statement-breakpoint
CREATE TABLE `uso_habitual_bicicleta` (
	`id` text PRIMARY KEY NOT NULL,
	`usoHabitualBicicleta` text
);
--> statement-breakpoint
CREATE TABLE `vehiculo` (
	`hogar` text,
	`vehiculo` text PRIMARY KEY NOT NULL,
	`tipoVeh` integer,
	`marcaVeh` integer,
	`modeloVeh` text,
	`anoVeh` integer,
	`edadVehiculo` integer,
	`cilindradaVeh` integer,
	`combustible` integer,
	`selloVerde` integer,
	`propiedad` integer
);
--> statement-breakpoint
CREATE TABLE `viaje` (
	`hogar` text,
	`persona` text,
	`viaje` text PRIMARY KEY NOT NULL,
	`etapas` integer,
	`comunaOrigen` integer,
	`comunaDestino` integer,
	`sectorOrigen` integer,
	`sectorDestino` integer,
	`zonaOrigen` integer,
	`zonaDestino` integer,
	`origenCoordX` real,
	`origenCoordY` real,
	`destinoCoordX` real,
	`destinoCoordY` real,
	`proposito` integer,
	`propositoAgregado` integer,
	`actividadDestino` text,
	`mediosUsados` text,
	`modoAgregado` text,
	`modoPriPub` integer,
	`modoMotor` integer,
	`horaIni` text,
	`horaFin` text,
	`horaMedia` text,
	`tiempoViaje` integer,
	`tiempoMedio` integer,
	`periodo` integer,
	`minutosDespues` integer,
	`cuadrasDespues` integer,
	`factorLaboralNormal` real,
	`factorSabadoNormal` real,
	`factorDomingoNormal` real,
	`factorLaboralEstival` real,
	`factorFindesemanaEstival` real,
	`codigoTiempo` integer
);
--> statement-breakpoint
CREATE TABLE `viajes_difusion` (
	`viaje` text PRIMARY KEY NOT NULL,
	`modoDifusion` text
);
