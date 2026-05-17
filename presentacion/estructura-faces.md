# Estructura Deck — faces.app

> Deck interactivo y explorable. Complementa el video de 1:30.
> El jurado puede navegar libremente entre secciones.
> **No hay limite de contenido** — aprovechar para poner todo lo que no cabe en 90 segundos.

---

## Principios del Deck

- **No repite el video** — profundiza lo que en 90 segundos no cabe
- **Se sostiene solo** — si el jurado lo ve sin ver el video, entiende igual
- **Visual > texto** — frases cortas, multimedia, datos visuales
- **El link a la app en vivo es el asset mas fuerte** — incluirlo prominente
- **Mas contenido = mas inmersion** — noticias, entrevistas, graficos, fotos. Todo suma.

---

## Estructura Completa (12 secciones)

### Flujo narrativo:

```
PROBLEMA → EVIDENCIA → VOCES → SOLUCION → PRODUCTO → TECNICO → DATOS → IMPACTO → CONTEXTO → VISION → EQUIPO
```

---

### 1. EL PROBLEMA

**Contenido:**
- Dato impactante grande: "Santiago: una de las ciudades mas contaminadas del mundo"
- Segundo dato: "El transporte genera ~1/3 de las emisiones de la ciudad"
- Imagen/grafica de contaminacion o trafico en Santiago

**Tono:** Urgencia. Que el jurado sienta el problema antes de ver la solucion.

**Tips faces.app:** Fondo oscuro, texto grande, una sola imagen potente.

---

### 2. NOTICIAS Y EVIDENCIA

**Contenido:**
- Clip de Meganoticias embebido (Santiago entre las mas contaminadas)
- Otros titulares/clips si encuentran:
  - Cierres de estaciones de Metro y caos de transporte
  - Alertas ambientales / preemergencias en Santiago
  - Congestion vehicular en hora punta
- Capturas de noticias con fecha visible ("esto pasa ahora, no es un problema teorico")
- Si encuentran datos de la OMS o rankings de contaminacion, incluirlos

**Tono:** Periodistico. Evidencia real, no opinion.

**Tips faces.app:** Multimedia — videos embebidos, capturas de pantalla de noticias, titulares recortados. Que parezca un mural de evidencia. Poner fecha a cada noticia para dar contexto temporal.

**Ideas de contenido adicional:**
- Tweets/posts de gente quejandose de cierres de Metro
- Datos de calidad del aire de Santiago (hay estaciones publicas de monitoreo)
- Comparacion con otras capitales de LATAM en contaminacion

---

### 3. VOCES / ENTREVISTAS

**Contenido:**
- Mini entrevista(s) grabadas en video
- Opciones de entrevistados:
  - Gente en la calle / estacion de Metro: "Que haces cuando cierran tu estacion?"
  - Compañeros de universidad que usan transporte publico
  - Ustedes mismos hablando a camara sobre por que hicieron esto
  - Si pueden: alguien con mas autoridad (profe de urbanismo, funcionario, conductor de micro)
- Puede ser la misma entrevista del video de 1:30 en version extendida, o tomas que no cupieron

**Tono:** Humano, cercano. Darle cara al problema.

**Tips faces.app:** Videos cortos (30-60 seg cada uno). No necesitan produccion perfecta — el celular esta bien. La autenticidad importa mas que la calidad de produccion. Si faces.app permite multiples videos en una seccion, poner varios cortos mejor que uno largo.

---

### 4. LA SOLUCION

**Contenido:**
- Nombre del proyecto (placeholder: [NOMBRE DEL PROYECTO])
- Frase: "Un mapa interactivo que simula el impacto ambiental de cambios en la red de transporte de Santiago"
- Screenshot del mapa (vista general con capas activas)

**Tono:** Claro, directo. En 5 segundos el jurado entiende que es.

**Tips faces.app:** Screenshot grande, texto minimo. Que el mapa hable.

---

### 5. DEMO EN VIVO

**Contenido:**
- **Link directo a la app deployada** (prominente, boton o URL grande)
- Texto: "Explora el mapa tu mismo"
- GIF corto mostrando la interaccion (backup visual)
- Instruccion rapida: "Activa capas → Haz click en una estacion → Ve el impacto"

**Tono:** Invitacion a interactuar.

**Tips faces.app:** El link es el protagonista. Si faces.app permite embeber iframes, intentar meter el mapa directamente. Si no, link grande + GIF de respaldo.

---

### 6. COMO FUNCIONA

**Contenido:**
- Diagrama simple (izquierda a derecha o arriba a abajo):

```
[Datos oficiales]          [Modelo]              [Resultado]

EOD 2012 (100K hogares)    Shift modal:          Mapa interactivo
GTFS Metro + Buses    -->  cierre estacion  -->  con simulacion
Ciclovias OCUC             = mas autos           de CO2 en
Comunas RM                 = mas CO2             tiempo real
```

- Una linea: "El modelo calcula cuantas personas cambian de Metro a auto cuando se cierra una estacion, y cuanto CO2 extra genera eso."

**Tono:** Tecnico pero accesible. No intimidar, pero demostrar que hay sustancia.

**Tips faces.app:** Diagrama visual limpio. Nada de parrafos. Si faces.app soporta diagramas interactivos o animados, mejor.

---

### 7. DATOS Y FUENTES

**Contenido:**

| Fuente | Que aporta |
|--------|-----------|
| **EOD 2012 — SECTRA** | Patrones de viaje de 100.000+ hogares de Santiago (origen, destino, modo, horario) |
| **GTFS — DTPM** | Red completa de Metro y buses RED: recorridos, estaciones, frecuencias, horarios |
| **Ciclovias — OCUC** | Red de ciclovias georeferenciada de toda la Region Metropolitana |
| **Comunas RM** | Limites geograficos oficiales para contexto espacial |

- Frase: "100% datos publicos y oficiales del gobierno de Chile"
- Logos de las instituciones si los encuentran (SECTRA, MTT, DTPM)

**Tono:** Credibilidad. "Esto no es inventado, son datos reales."

**Tips faces.app:** Tabla limpia o iconos por cada fuente. Que se vea institucional y serio.

---

### 8. DATOS EXPANDIDOS

**Contenido:**
- Graficos/infografias que no caben en el video:
  - Distribucion de viajes por modo de transporte (Metro vs bus vs auto vs bici)
  - Mapa de calor de origenes/destinos de la EOD
  - Evolucion del parque automotor de Santiago (si encuentran datos)
  - Grafico de emisiones por sector (transporte vs industria vs residencial)
- Screenshots de datos crudos o tablas de la base de datos (para mostrar volumen y realidad)
- Cualquier visualizacion que hayan hecho durante el desarrollo

**Tono:** "Miren la profundidad de datos que hay detras." Satisface al jurado tecnico (Omar Florez, Jose Diaz).

**Tips faces.app:** Graficos limpios, sin demasiada explicacion. Los datos hablan solos. Si tienen muchos, mejor — el jurado puede scrollear/explorar.

---

### 9. IMPACTO

**Contenido:**
- Numero grande: "X toneladas de CO2 por ano por una estacion cerrada"
- Equivalencia: "= sacar X arboles" o "= X autos nuevos circulando todos los dias"
- Frase: "Y esto es solo una estacion. Santiago tiene 136."
- Si pueden: comparar con alguna medida que la gente entienda (vuelos Santiago-Buenos Aires, hectareas de bosque, etc.)

**Tono:** Contundente. Numeros que impacten.

**Tips faces.app:** Numeros enormes, tipografia bold. Fondo limpio. Menos es mas.

---

### 10. CONTEXTO SANTIAGO

**Contenido:**
- Fotos propias o libres de uso:
  - Taco en hora punta (Alameda, Providencia, etc.)
  - Estacion de Metro llena
  - Smog sobre Santiago (vista desde cerro)
  - Ciclovias vs calles congestionadas
- Datos de contexto:
  - Poblacion RM (~8 millones)
  - Viajes diarios en transporte publico (~X millones)
  - Cantidad de estaciones de Metro (136)
  - Km de red de buses RED
- Comparacion con otras ciudades si tienen datos (Bogota, CDMX, Buenos Aires)
- Timeline de expansiones del Metro (para mostrar que la red crece y cada decision importa)

**Tono:** Contextual. "Santiago es una ciudad compleja y este problema es real aqui."

**Tips faces.app:** Galeria de fotos + datos sueltos. Que el jurado sienta que conocen la ciudad y el problema de primera mano.

---

### 11. VISION / FUTURO

**Contenido:**
- "Hoy: Santiago"
- "Manana: cualquier ciudad con datos de transporte publico (GTFS es un estandar mundial)"
- Posibles expansiones:
  - Mas variables: contaminacion local (PM2.5), ruido, accesibilidad
  - Escenarios complejos: nuevas lineas, cambios de frecuencia, eventos masivos
  - API para planificadores urbanos y municipalidades
  - Integracion con datos en tiempo real (GPS de buses, conteo de pasajeros)

**Tono:** Ambicioso pero creible. Moonshot aterrizado.

**Tips faces.app:** Timeline o roadmap visual simple. No prometer demasiado, pero mostrar que el modelo es extensible.

---

### 12. EQUIPO

**Contenido:**
- Nombres y roles de cada integrante (1 linea cada uno)
- Foto o avatar (opcional)
- Contacto / GitHub / link si quieren

**Tono:** Breve, limpio. No es el foco pero cierra profesionalmente.

**Tips faces.app:** Layout horizontal, una fila con los integrantes. Minimalista.

---

## Orden de Navegacion

### Flujo por defecto (si faces.app lo permite):

```
Problema → Noticias → Voces → Solucion → Demo → Como Funciona → Datos → Datos Expandidos → Impacto → Contexto → Vision → Equipo
```

### Si el jurado tiene poco tiempo, las secciones imprescindibles:

1. **Demo en Vivo** (link a la app — que lo prueben)
2. **Noticias y Evidencia** (el problema es real y actual)
3. **Impacto** (numeros concretos)

### Secciones que impresionan a jurados especificos:

| Jurado | Secciones que le van a importar mas |
|--------|-------------------------------------|
| Miguel Paz (storytelling) | Problema, Noticias, Voces, Impacto |
| Jose Diaz Munoz (tecnico) | Como Funciona, Datos, Datos Expandidos, Demo |
| Omar Florez (academico) | Como Funciona, Datos Expandidos, Impacto |
| Agustin Covarrubias (impacto) | Problema, Impacto, Vision |
| Raimundo Manterola (producto) | Demo en Vivo, Como Funciona, Vision |

---

## Checklist antes de armar en faces.app

- [ ] URL de la app deployada funcionando
- [ ] Screenshot del mapa (vista general con capas)
- [ ] GIF de la demo (15-20 seg, mostrando click en estacion + simulacion)
- [ ] Clip de Meganoticias (verificar que se puede embeber o subir)
- [ ] Mini entrevista(s) grabadas
- [ ] Fotos de Santiago (trafico, Metro, smog)
- [ ] Diagrama tecnico simple
- [ ] Graficos/infografias de datos (distribucion de viajes, emisiones, etc.)
- [ ] Numeros finales de impacto CO2 (correr la simulacion y sacar datos reales)
- [ ] Nombre del proyecto definido
- [ ] Nombres del equipo


# links
https://www.red.cl/red-comunica/buses-red-generan-solo-el-33-de-las-emisiones-del-transporte-en-santiago-el-90-viene-de-autos-y-motos-particulares/
