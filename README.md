# Pulso Urbano

![Favicon](/public/favicon.ico)

**Pulso Urbano** es una herramienta de simulación urbana interactiva que permite visualizar y comprender cómo se mueve Santiago en términos de transporte y contaminación atmosférica y acústica.

Santiago es una de las ciudades más contaminadas de América Latina. El transporte es uno de los mayores contribuyentes, y cada decisión sobre infraestructura —cerrar una estación de metro, abrir una nueva línea— tiene un costo ambiental que nadie cuantifica en tiempo real. **Pulso Urbano hace visible lo invisible.**

---

## El Problema

- **~1/3** de las emisiones de Santiago provienen del transporte
- **90%** de esas emisiones vienen de autos y motos particulares
- **La contaminación acústica** en zonas urbanas puede superar los 70 dB(A), afectando la salud de miles de personas
- Cada día, miles de personas se ven obligadas a cambiar su modo de transporte cuando hay cierres en la red de metro, sin que nadie haya calculado el impacto ambiental real

## La Solución

Un mapa interactivo que simula escenarios de transporte y muestra su impacto en congestión, contaminación atmosférica (PM2.5) y ruido (dB), permitiendo que planificadores urbanos, tomadores de decisiones y ciudadanos puedan **ver el costo ambiental antes de que ocurra**.

---

## Características

### Para Todos
- **Mapa interactivo de Santiago** con comunas, líneas de metro, buses RED y ciclovías
- **Visualización de flujos de movilidad** en base a datos históricos
- **Simulación de cambio de medio de transporte** de los viajes intercomunales
- **Estimación de impacto ambiental** — CO2, PM2.5 y ruido (dB) por cada escenario simulado
- **Gauge de ruido en vivo** — nivel promedio de ruido por comuna en dB(A), con escala de 30 a 85 dB

### Para Técnicos
- Datos reales de la **Encuesta Origen-Destino (EOD)** — más de 100,000 hogares encuestados por SECTRA
- Integración con **GTFS** (General Transit Feed Specification) del Directorio de Transporte Público Metropolitano
- Mapa de **ruido ambiental (Lden)** con datos georeferenciados por zonas y comunas
- Procesamiento geoespacial con **MapLibre GL**
- Backend en **Cloudflare Workers** con base de datos **D1** (SQLite en la edge)
- Stack moderno: TanStack Start, React, Tailwind CSS v4

---

## Datos y Fuentes

| Fuente | Descripción |
|--------|-------------|
| **EOD 2012 (SECTRA)** | Encuesta Origen-Destino de Santiago, +100,000 hogares |
| **GTFS DTPM** | Recorridos, frecuencias y horarios del transporte público metropolitano |
| **Ciclovías OCUC** | Red de ciclovías georeferenciada del Observatorio de Ciudades UC |
| **Comunas RM** | Límites geográficos oficiales de la Región Metropolitana |

---

## Stack Tecnológico

| Componente | Tecnología |
|------------|------------|
| Frontend | React + TanStack Start |
| Mapas | MapLibre GL |
| Base de datos | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Deployment | Cloudflare Workers (Wrangler) |

---

## Empieza

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm run dev
```

### Linting y Formato

```bash
npm run lint      # Biome lint
npm run format    # Biome format
npm run check     # Check completo (lint + format)
```

---

## Indies Hack

Este proyecto fue desarrollado en 54 horas para **[Indies Hack](https://indieshack.com)**, una hackatón que impulsa soluciones tecnológicas innovadoras con impacto real. Porque resolver problemas urbanos complejos requiere herramientas que hagan la información accesible tanto para técnicos como para ciudadanos.

---

## Autores
- Felipe Jara Ribet
- Alejandra Campos Urbina
- Manuel Alejandro Sepúlveda Cabeza
- Alejandro Damián Hernández Carreño


**Licencia:** MIT