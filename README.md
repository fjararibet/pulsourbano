# SimSantiago

Mapa interactivo de movilidad para Santiago de Chile: Metro, recorridos
de buses RED, paraderos y red de ciclovías. La data se descarga desde
fuentes oficiales y se sirve como GeoJSON estático.

## Stack

- **TanStack Start** + **TanStack Router** (SSR opcional, file-based routing).
- **MapLibre GL** para el mapa.
- **Tailwind CSS v4** para los estilos.
- **Biome** para lint y format.
- **Cloudflare Workers** (vía `@cloudflare/vite-plugin` + `wrangler`) como
  target de deploy.

## Cómo correrlo

```bash
npm install
npm run data:build   # primera vez: descarga GTFS + ciclovías
npm run dev          # http://localhost:3000
```

El pipeline de datos (`npm run data:build`) descarga el GTFS vigente del
DTPM y la red de ciclovías de OCUC, y deja archivos en `public/data/`:

- `metro.geojson` — líneas y estaciones de Metro.
- `buses.geojson` — recorridos y paraderos RED.
- `ciclovias.geojson` — red ciclista AMS.
- `frequencies.json` — frecuencia media por servicio.

El zip de GTFS (~50 MB) se cachea en `.cache/` para no redescargarlo
cada vez.

## Scripts

| Comando             | Qué hace                                            |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo en `:3000`.                  |
| `npm run build`     | Build de producción.                                |
| `npm run preview`   | Sirve el build.                                     |
| `npm run check`     | Biome (lint + format check).                        |
| `npm run lint`      | Solo lint.                                          |
| `npm run format`    | Solo format.                                        |
| `npm run data:build`| Regenera los GeoJSON desde GTFS/OCUC.               |
| `npm run deploy`    | Build + `wrangler deploy` (Cloudflare).             |

## Estructura

```
src/
  routes/
    __root.tsx               Layout raíz (head, fuentes, etc.)
    index.tsx                Route "/" → renderiza SantiagoMapPage
  map/
    SantiagoMapPage.tsx      UI: panel lateral + contenedor del mapa
    Legend.tsx               Leyenda esquina inferior derecha
    use-santiago-map.ts      Hook que inicializa MapLibre y carga data
    config.ts                Centro/zoom, colores, capas, BASE_STYLE
    layers.ts                addMetro/Bus/CyclewayLayers + visibilidad
    hover.ts                 Handlers de hover y popups
    utils.ts                 loadGeoJSON, helpers de features y formato
    types.ts                 LayerId, HoverInfo, FrequencyMap, etc.
  router.tsx                 Factory del router de TanStack
  routeTree.gen.ts           (autogenerado por TanStack)
  styles.css                 Tailwind + estilos del mapa/popups
scripts/
  build-data.ts              Pipeline GTFS → GeoJSON
public/
  data/                      Salida del pipeline (ignorada en deploy si querés)
```

## Fuentes de datos

- **DTPM GTFS vigente** — Metro + Buses RED.
  <https://www.dtpm.cl/index.php/noticias/gtfs-vigente>
- **OCUC Ciclovías RM** — Red de ciclovías del AMS.
  <https://opendata.arcgis.com/datasets/964ce19732c94fe1a211443ca0a08a09_0.geojson>

Si las URLs cambian, ajustá las constantes en `scripts/build-data.ts`.

## Deploy

```bash
npm run deploy
```

Requiere `wrangler login` previo y el binding D1 declarado en
`wrangler.jsonc` (aunque hoy la app no consulta la DB; queda preparado
para features futuras).
