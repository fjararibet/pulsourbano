# Research Jurado — HackLatam Tech for Good

> Documento de referencia interna. No es contenido de la presentacion.

---

## Track: Medio Ambiente & Riesgo Climatico

**Objetivo del track:** Rastrear, predecir y mitigar el dano ambiental. Construir herramientas que monitoreen riesgo, pronostiquen dano y ayuden a comunidades, respondedores o instituciones a actuar antes de que empeore.

---

## Criterios de Evaluacion

| Criterio | Peso | Que buscan | Nuestra estrategia |
|----------|------|------------|-------------------|
| **Impacto social** | 30% | Cuanto mejora la vida de las personas | Narrativa fuerte: comunidades afectadas por cierres de estaciones, costo en salud por contaminacion. Numeros concretos. |
| **Moonshot** | 20% | Se siente como 1 ano de progreso en 1 dia | "Antes: meses de estudio de impacto. Ahora: simulacion en segundos." Comprimir tiempo. |
| **Complejidad tecnica** | 20% | Mas que solo prompting | Multiples fuentes de datos reales (EOD, GTFS, GeoJSON), modelo de shift modal, pipeline de procesamiento, stack moderno. |
| **Factor de novedad** | 15% | Enfoque nuevo al problema | Combinar encuesta de movilidad + datos de transporte en tiempo real + simulacion espacial. No existe herramienta publica equivalente en Chile. |
| **Listo para usar** | 15% | Lo puedo usar ahora | Demo funcional con URL. Mapa interactivo que el jurado podria abrir. |

**Conclusion estrategica:** Storytelling + impacto social es el 30% mas grande. Luego moonshot y complejidad tecnica (20% cada uno). El video debe abrir con el problema humano, no con la solucion tecnica.

---

## Perfiles del Jurado

### 1. Miguel Paz — Fundador & CEO @ Reveniu (Chile)

**Background:**
- Periodista convertido en emprendedor tech
- Nieman Fellow en Harvard (2014-2015): innovacion, redes (Cesar Hidalgo, MIT Media Lab), participatory media
- Reveniu: plataforma chilena de pagos recurrentes (tipo Stripe para LATAM), orientada a ONGs, medios, startups
- Knight News Challenge winner (2011) con Poderopedia.com ($200K Knight Foundation)
- Inversor angel en Shinkansen y comOS

**Que le importa:**
- Impacto social real y medible
- Soluciones sin friccion, escalabilidad en mercados emergentes
- Modelos de negocio sostenibles
- Storytelling periodistico — narra bien el problema

**Estrategia:**
- Mostrar que la solucion puede escalar sin barreras tecnicas
- Modelo de adopcion claro (datos publicos = cualquier ciudad puede replicar)
- Narrativa fuerte del problema. El es periodista — valora la historia.

---

### 2. Jose Diaz Munoz — CTO @ Climadapt, President @ Boquila Foundation (Chile)

**Background:**
- Boquila Foundation: ONG tech "AIs for nature". Repo `boquilahub` (160 stars, Rust). Tambien `ocrisp` (RAG) y `.bq` (formato de modelos)
- Climadapt: empresa de adaptacion climatica
- Desarrollador activo en GitHub (@jdiaz97). Rust, modelos de IA para biodiversidad. Open-source.

**Que le importa:**
- IA aplicada a conservacion
- Modelos eficientes (edge computing)
- Open-source
- Solucion tecnica real (no solo prompting)
- Adaptacion climatica concreta

**Estrategia:**
- **Jurado mas alineado con nuestro track.** Demostrar profundidad tecnica real.
- Mostrar que la herramienta funciona (no solo prompts).
- Mencionar que usamos datos abiertos y que la arquitectura es replicable.
- Si podemos mostrar el pipeline de datos (GTFS -> procesamiento -> simulacion), mejor.

---

### 3. Omar Florez — Research @ CENIA (Chile)

**Background:**
- CENIA: Centro Nacional de Inteligencia Artificial de Chile
- Desarrollan Latam-GPT (primer LLM regional abierto)
- Publican en ICML, ICLR, IJCAI
- Trabajan con UNESCO, AMD, NVIDIA, AWS
- Areas: ML/deep learning, NLP, vision, IA etica, benchmarks regionales

**Que le importa:**
- Rigor cientifico
- Complejidad tecnica genuina
- Novedad en el enfoque
- Reproducibilidad
- IA responsable, aplicaciones basadas en datos

**Estrategia:**
- Fundamento tecnico solido. Explicar el modelo de shift modal brevemente.
- Si podemos mostrar validacion con datos reales (EOD tiene factores de expansion), mencionarlo.
- Evitar que parezca "solo un mapa bonito" — el modelo detras tiene logica real.

---

### 4. Agustin Covarrubias — Director @ Kairos Project

**Background:**
- Vinculado a proyectos de impacto social con tecnologia en LATAM

**Que le importa:**
- Impacto social
- Narrativa de "moonshot" — que el proyecto se sienta como un salto real

**Estrategia:**
- Enfocarse en el impacto social (30% del peso)
- Que el video transmita: "esto comprime un ano de trabajo en un dia"

---

### 5. Raimundo Manterola — CTO @ Watermind (Chile)

**Background:**
- Watermind.io: plataforma de gestion inteligente de agua (fundada 2025, 2-10 empleados)
- Monitoreo en tiempo real de bombas, tanques, pozos. Alertas predictivas, control remoto, analitica.
- IoT para agua. Clientes: agricola, municipal, comercial. Alternativa a SCADA.
- Especialidades: Smart Water Management, IoT, Predictive Maintenance, Telemetry

**Que le importa:**
- Soluciones tecnicas que funcionan YA (IoT, sensores, datos en tiempo real)
- Gestion de recursos, eficiencia
- Mantenimiento predictivo
- Producto listo para usar

**Estrategia:**
- Mostrar que la herramienta tiene aplicacion inmediata.
- Que se puede usar hoy (URL, demo funcional).
- El criterio "Listo para usar" (15%) es donde mas pesa su vision.

---

## Formato de Entrega

- **Video:** 1 minuto 30 segundos, grabado y editado
- **Plataforma:** faces.app
- **No hay Q&A posterior** — el video es la unica oportunidad de comunicar

### Sobre faces.app

Faces es una plataforma para crear decks interactivos y explorables. Las presentaciones no son slides tradicionales — son navegables. Si se usa como complemento al video:
- Interactiva (no solo lectura lineal)
- Visual y concisa
- Navegable (el jurado puede explorar secciones)

---

## Resumen de Prioridades

1. **Storytelling > tecnico.** El video debe emocionar primero y demostrar despues.
2. **Jose Diaz Munoz** (Boquila/Climadapt) y **Raimundo Manterola** (Watermind) son los jurados mas alineados con el track.
3. **Omar Florez** (CENIA) evaluara con ojo tecnico — el modelo tiene que sostenerse.
4. **Miguel Paz** (Reveniu) valora narrativa clara y escalabilidad.
5. **30% del puntaje es impacto social** — esa es la prioridad #1 en el video.
6. Al ser solo video sin Q&A, todo tiene que quedar claro en 90 segundos. No hay segunda oportunidad.
