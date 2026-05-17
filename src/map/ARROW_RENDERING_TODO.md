# Arrow rendering — future migration to native MapLibre layer

## Context

The current implementation (`ArrowScene.ts`) renders route arrows on a Canvas2D
overlay that sits on top of the MapLibre canvas. It now uses cached
projections, an offscreen static layer, a 30fps RAF tick, and `Float32Array`
buffers — performance is acceptable for the 4-route inter-comuna case.

The remaining ceiling is that the CPU is still doing the projection math and
the Canvas2D rasterization. For larger fan-outs (one-to-many origin/destination
visualization, or animating dozens of OD pairs at once) we will want to push
the entire arrow pipeline onto the GPU via MapLibre's own layer system.

## Proposed approach

Replace the Canvas2D overlay with native MapLibre layers driven by a GeoJSON
source. The comet animation becomes a `line-gradient` whose stops are updated
per frame.

### Sources

- One `geojson` source per arrow (or a single source with `id`-keyed features
  if MapLibre's `line-gradient` works with feature-state — needs verification).
- Geometry: the projected/elevated polyline is *not* needed; MapLibre projects
  on the GPU. Pass the raw lng/lat polyline from `route-store.ts` directly.

### Layers per arrow

1. **glow** — `line` layer, wider, lower alpha (`line-color` with `rgba(...)`).
2. **base** — `line` layer, thinner, full alpha.
3. **comet** — `line` layer with `line-gradient` expression.
4. **arrowhead** — `symbol` layer with a triangle icon placed at the last
   coordinate, rotated to match the final segment bearing.

### Comet animation

`line-gradient` accepts a step/interpolate expression keyed on `line-progress`
(values 0..1 along the line). Update the gradient stops each frame to slide
a bright band along the line:

```js
map.setPaintProperty(`arrow-comet-${id}`, 'line-gradient', [
  'interpolate', ['linear'], ['line-progress'],
  Math.max(0, head - tailFraction), 'rgba(255,255,255,0)',
  head, 'rgba(255,255,255,1)',
  Math.min(1, head + 0.001), 'rgba(255,255,255,0)',
]);
```

Caveat: `line-gradient` requires `lineMetrics: true` on the source. Also,
`setPaintProperty` per frame at 30fps × 4 arrows is fine, but profile before
fan-out scenarios.

### Arch elevation

The current arched look is a *screen-space* effect (vertical lift in pixels,
not in geography). MapLibre layers project geography → screen on the GPU, so
the arch effect cannot be reproduced with vanilla `line` layers. Options:

- Pre-compute the arched polyline in lng/lat by offsetting along the great-circle
  normal in geographic space. The arch will then *correctly* deform with the
  map projection and pitch — arguably more honest.
- Or drop the arch entirely (3 of the 4 current variants already have
  `archHeight: 0`).
- Or write a custom WebGL layer (`map.addLayer({ type: 'custom', render(gl) {...} })`)
  that lifts in screen space — more work but preserves the current look.

## Migration steps

1. Add a feature flag to switch between Canvas2D overlay (current) and
   MapLibre-layer implementation.
2. Implement the four-layer pipeline above for a single arrow.
3. Verify visual parity at typical inter-comuna zoom levels.
4. Add the per-frame `line-gradient` comet animation.
5. Replace `ArrowScene` callers in `use-santiago-map.ts`.
6. Delete the Canvas2D overlay and the `ArrowScene.ts` module.

## Why we didn't do it now

- The Canvas2D overlay was already wired and the bottleneck was elsewhere
  (per-frame projection, shadowBlur, full polyline restroke). Those are fixed.
- The arch effect needs a design decision (geographic offset vs. drop vs.
  custom WebGL) before a like-for-like migration.
- Native layers shine when the arrow count grows beyond a handful; for 4
  arrows the current path is fast enough.
