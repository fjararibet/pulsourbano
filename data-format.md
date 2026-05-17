# Tablas de la base de datos remota (EOD2012)

Este documento contiene los nombres de todas las tablas existentes en la base de datos remota `EOD2012` (D1) al momento de su generación.

## Listado de tablas

1. `_cf_KV`
2. `d1_migrations`
3. `sqlite_sequence`
4. `todos`
5. `actividad`
6. `actividad_destino`
7. `actividad_empresa`
8. `adulto_mayor`
9. `autopista`
10. `circulacion_bicicleta`
11. `codigo_tiempo`
12. `combustible`
13. `comuna`
14. `conoce_transantiago`
15. `discapacidad`
16. `distancia_viaje`
17. `donde_estudia`
18. `edad_personas`
19. `edad_vehiculo`
20. `estacion_metro`
21. `estacion_metro_cambio`
22. `estacion_tren`
23. `estaciona`
24. `estaciona_bicicleta`
25. `estudios`
26. `etapa`
27. `etapas`
28. `forma_pago`
29. `hogar`
30. `horario_metro`
31. `ingreso_imputado`
32. `jornada_trabajo`
33. `licencia_conducir`
34. `marca_veh`
35. `medio_viaje_restriccion`
36. `medios_usados`
37. `modo`
38. `modo_difusion`
39. `modo_estaciona_bicicleta`
40. `modo_motor`
41. `modo_pri_pub`
42. `no_usa_autopista`
43. `no_usa_transantiago`
44. `no_viaja`
45. `ocupacion`
46. `pase_escolar`
47. `periodo`
48. `persona`
49. `propieda_bicicleta`
50. `propiedad`
51. `propiedad_vehiculo`
52. `proposito`
53. `proposito_agregado`
54. `recorrido_transantiago`
55. `relacion`
56. `sector`
57. `sello_verde`
58. `sexo`
59. `sexo_viaje`
60. `temporada`
61. `tiempo_medio`
62. `tiene_ingresos`
63. `tipo_dia`
64. `tipo_veh`
65. `tramo_ingreso`
66. `usa_ciclovia`
67. `uso_habitual_bicicleta`
68. `vehiculo`
69. `viaje`
70. `viajes_difusion`

---

## Nota sobre tablas de ubicación / geometrías (revisión parcial)

> Revisión realizada el 16 de mayo de 2026 para evaluar si existen datos geoespaciales (GeoJSON) disponibles para trazar rutas por calle y metro.

### Hallazgo principal

**No existe la tabla `bus_features` en la base de datos remota.**
Aunque el esquema local (`src/db/dtpmgeo-schema.ts`) define una tabla `bus_features` con campos `kind`, `geometry` y `properties`, esta tabla **no está presente** en `EOD2012` remota. Por lo tanto, **no hay campos GeoJSON nativos** en la base de datos actual.

### Tablas que sí contienen coordenadas de ubicación

Las coordenadas existen como campos numéricos individuales (`CoordX`, `CoordY`), aparentemente en un sistema de coordenadas proyectadas (probablemente **UTM 19S / EPSG:32719**, común en Santiago de Chile).

| Tabla | Campos de coordenadas | Descripción |
|-------|----------------------|-------------|
| `hogar` | `dirCoordX`, `dirCoordY` | Ubicación geocodificada del hogar. |
| `persona` | `dirActividadCoordX`, `dirActividadCoordY` | Ubicación del lugar de trabajo/actividad. |
| `persona` | `dirEstudiosCoordX`, `dirEstudiosCoordY` | Ubicación del lugar de estudios. |
| `viaje` | `origenCoordX`, `origenCoordY` | Punto de origen del viaje. |
| `viaje` | `destinoCoordX`, `destinoCoordY` | Punto de destino del viaje. |
| `etapa` | `origenCoordX`, `origenCoordY` | Origen de la etapa (tramo del viaje). |
| `etapa` | `destinoCoordX`, `destinoCoordY` | Destino de la etapa. |

### Ejemplos reales de coordenadas

**`viaje` (origen/destino):**

| viaje | origenCoordX | origenCoordY | destinoCoordX | destinoCoordY |
|-------|-------------|-------------|--------------|--------------|
| 1734310202 | 335208.72 | 6288387 | 338812.31 | 6292391 |
| 1734410101 | 338536.44 | 6291928 | 354267.34 | 6302297 |

**`hogar` (dirección):**

| hogar | dirCoordX | dirCoordY |
|-------|-----------|-----------|
| 100010 | 335180.80 | 6266420.97 |
| 100020 | 338410.21 | 6265607.14 |

**`etapa` (con estaciones y recorridos):**

| etapa | origenCoordX | origenCoordY | destinoCoordX | destinoCoordY | estacionMetroIni | estacionMetroFin | recorridoTransantiago |
|-------|-------------|-------------|--------------|--------------|------------------|------------------|----------------------|
| 10001001011 | 335180.81 | 6266421 | 335198.16 | 6266360 | null | null | null |
| 10001001021 | 335198.16 | 6266360 | 335180.81 | 6266421 | null | null | null |

### Referencias a recorridos (códigos, no geometrías)

La tabla `etapa` contiene códigos de recorrido, pero **no contiene las geometrías de las líneas**:

- `recorridoTransantiago` — Código del servicio de bus (ej. "210", "425").
- `recorridoTxc` — Código de recorrido de taxi colectivo.
- `estacionMetroIni` / `estacionMetroFin` — Códigos de estación de metro (relacionados con catálogo `estacion_metro`).
- `estacionTrenIni` / `estacionTrenFin` — Códigos de estación de tren (relacionados con catálogo `estacion_tren`).

### Conversión a GeoJSON `LineString`

Dado que no hay geometrías de línea predefinidas, debes **construir el LineString** a partir de los puntos disponibles.

#### 1. LineString básico para un viaje/etapa (origen → destino)

Si solo tienes origen y destino:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [origenCoordX, origenCoordY],
      [destinoCoordX, destinoCoordY]
    ]
  },
  "properties": {
    "viaje": "1734310202",
    "tipo": "viaje_directo"
  }
}
```

> **Importante:** El orden GeoJSON es `[X, Y]`, que coincide directamente con los campos `CoordX` (este) y `CoordY` (norte).

#### 2. Ejemplo de SQL para generar el GeoJSON en D1

D1 (SQLite) no tiene funciones PostGIS, pero puedes armar el JSON como texto:

```sql
SELECT
  viaje,
  json_object(
    'type', 'Feature',
    'geometry', json_object(
      'type', 'LineString',
      'coordinates', json_array(
        json_array(origenCoordX, origenCoordY),
        json_array(destinoCoordX, destinoCoordY)
      )
    ),
    'properties', json_object('viaje', viaje)
  ) AS geojson
FROM viaje
WHERE origenCoordX IS NOT NULL
  AND destinoCoordX IS NOT NULL
LIMIT 5;
```

#### 3. Para rutas por calle y metro (multietapa)

Si necesitas una línea que pase por **todas las etapas** de un viaje, debes hacer `JOIN` con `etapa` y ordenar por el número de etapa, concatenando los puntos de origen de cada etapa y el destino de la última:

```sql
SELECT
  v.viaje,
  json_object(
    'type', 'Feature',
    'geometry', json_object(
      'type', 'LineString',
      'coordinates', (
        SELECT json_group_array(json_array(e.origenCoordX, e.origenCoordY))
        FROM etapa AS e
        WHERE e.viaje = v.viaje
        ORDER BY e.etapa
      )
    ),
    'properties', json_object('viaje', v.viaje, 'etapas', v.etapas)
  ) AS geojson
FROM viaje AS v
WHERE v.etapas > 1
LIMIT 3;
```

> **Nota:** La consulta anterior arma el arreglo con los orígenes de cada etapa. Para cerrar la línea con el destino final, deberías agregar manualmente el `destinoCoordX/Y` de la última etapa al final del arreglo (requiere lógica adicional en la aplicación).

#### 4. Proyección de coordenadas

Las coordenadas de la EOD2012 están en **UTM 19S** (EPSG:32719 aproximado). Para usarlas en mapas web (Leaflet, Mapbox, etc.) que esperan WGS84 (EPSG:4326, lon/lat), necesitas reproyectarlas. Ejemplo con `proj4` en JavaScript:

```javascript
import proj4 from 'proj4';

// Definición UTM 19S (WGS84)
proj4.defs('EPSG:32719', '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs');

const [lon, lat] = proj4('EPSG:32719', 'EPSG:4326', [335208.71875, 6288387]);
// lon, lat ≈ (-70.65, -33.45)  (Santiago)
```

Luego el LineString en GeoJSON válido usaría `[lon, lat]`:

```json
{
  "type": "LineString",
  "coordinates": [[-70.65, -33.45], [-70.63, -33.42]]
}
```

### Conclusión

- **No hay GeoJSON ni geometrías de calles/metro en la DB remota.**
- **Solo hay puntos proyectados (X/Y)** para orígenes y destinos de viajes, etapas, hogares y actividades.
- Para trazar rutas reales por calle o por trazado de metro, necesitarás **geometrías externas** (ej. shapefiles de recorridos de Transantiago o líneas de metro) y cruzarlas por el código de recorrido (`recorridoTransantiago`) o estación (`estacionMetroIni`/`estacionMetroFin`).
- Si solo necesitas una línea recta entre origen y destino, puedes construir un `LineString` directamente con los campos `CoordX`/`CoordY` y reproyectar a WGS84.
