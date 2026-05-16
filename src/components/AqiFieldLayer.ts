import type { Map as MapLibreMap } from "maplibre-gl";
import { fieldStations } from "#/lib/aqi-field";

const VERTEX_SHADER = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform float u_lat_min;
uniform float u_lat_max;
uniform float u_lng_min;
uniform float u_lng_max;
uniform vec2 u_viewport;

uniform vec2 u_stations[6];
uniform float u_aqis[6];

// ── Simplex noise (Ashima Arts) ──
vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289_3(((x*34.0)+10.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289_2(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0) )
    + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ── Gaussian plume ──
float gaussian(vec2 p, vec2 center, float sigma) {
    vec2 d = p - center;
    return exp(-(d.x*d.x + d.y*d.y) / (2.0 * sigma * sigma));
}

// ── Smooth AQI color ramp (linear interpolation between stops) ──
vec3 aqiToColor(float aqi) {
    vec3 green  = vec3(0.133, 0.773, 0.369);
    vec3 yellow = vec3(0.918, 0.702, 0.031);
    vec3 orange = vec3(0.976, 0.451, 0.086);
    vec3 red    = vec3(0.937, 0.267, 0.267);
    vec3 purple = vec3(0.486, 0.227, 0.929);
    vec3 maroon = vec3(0.490, 0.0,   0.137);

    if (aqi < 50.0)  return mix(green,  yellow, (aqi - 0.0)   / 50.0);
    if (aqi < 100.0) return mix(yellow, orange, (aqi - 50.0)  / 50.0);
    if (aqi < 150.0) return mix(orange, red,    (aqi - 100.0) / 50.0);
    if (aqi < 200.0) return mix(red,    purple, (aqi - 150.0) / 50.0);
    if (aqi < 300.0) return mix(purple, maroon, (aqi - 200.0) / 100.0);
    return maroon;
}

void main() {
    float lat = u_lat_min + (gl_FragCoord.y / u_viewport.y) * (u_lat_max - u_lat_min);
    float lng = u_lng_min + (gl_FragCoord.x / u_viewport.x) * (u_lng_max - u_lng_min);

    vec2 pos = vec2(lat, lng);
    float aqi = 25.0;

    aqi += u_aqis[0] * gaussian(pos, u_stations[0], 0.035);
    aqi += u_aqis[1] * gaussian(pos, u_stations[1], 0.035);
    aqi += u_aqis[2] * gaussian(pos, u_stations[2], 0.035);
    aqi += u_aqis[3] * gaussian(pos, u_stations[3], 0.035);
    aqi += u_aqis[4] * gaussian(pos, u_stations[4], 0.035);
    aqi += u_aqis[5] * gaussian(pos, u_stations[5], 0.035);

    if (lng < -70.7) {
        aqi *= 1.3;
    }

    float noise = snoise(pos * 800.0);
    aqi += noise * 15.0;

    aqi = clamp(aqi, 0.0, 500.0);

    vec3 color = aqiToColor(aqi);
    gl_FragColor = vec4(color, 0.82);
}
`;

function compileShader(
	gl: WebGLRenderingContext,
	type: number,
	source: string,
): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error("[AQI] Shader compile error:", gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function createProgram(
	gl: WebGLRenderingContext,
	vs: string,
	fs: string,
): WebGLProgram | null {
	const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vs);
	const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fs);
	if (!vertexShader || !fragmentShader) {
		console.error("[AQI] Could not compile vertex or fragment shader");
		return null;
	}

	const program = gl.createProgram();
	if (!program) return null;

	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error("[AQI] Program link error:", gl.getProgramInfoLog(program));
		gl.deleteProgram(program);
		return null;
	}
	console.log("[AQI] Shader program linked successfully");
	return program;
}

export function createAqiFieldLayer() {
	let program: WebGLProgram | null = null;
	let buffer: WebGLBuffer | null = null;
	let mapInstance: MapLibreMap | null = null;
	let renderCount = 0;

	return {
		id: "aqi-field",
		type: "custom" as const,
		renderingMode: "2d" as const,

		onAdd(map: MapLibreMap, gl: WebGLRenderingContext) {
			console.log("[AQI] onAdd called");
			mapInstance = map;

			program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
			if (!program) {
				console.error("[AQI] Failed to create shader program in onAdd");
				return;
			}

			buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(
				gl.ARRAY_BUFFER,
				new Float32Array([-1, -1, 3, -1, -1, 3]),
				gl.STATIC_DRAW,
			);
			console.log("[AQI] Buffer created, layer ready");
		},

		render(gl: WebGLRenderingContext) {
			if (!mapInstance || !program || !buffer) {
				console.warn("[AQI] render skipped — not initialized", {
					hasMap: !!mapInstance,
					hasProgram: !!program,
					hasBuffer: !!buffer,
				});
				return true;
			}

			renderCount++;
			if (renderCount <= 3) {
				console.log(`[AQI] render called (#${renderCount})`);
			}

			const bounds = mapInstance.getBounds();
			const canvas = gl.canvas as HTMLCanvasElement;

			// Get uniform locations fresh each frame
			const aPosLoc = gl.getAttribLocation(program, "a_pos");
			const uLatMin = gl.getUniformLocation(program, "u_lat_min");
			const uLatMax = gl.getUniformLocation(program, "u_lat_max");
			const uLngMin = gl.getUniformLocation(program, "u_lng_min");
			const uLngMax = gl.getUniformLocation(program, "u_lng_max");
			const uViewport = gl.getUniformLocation(program, "u_viewport");
			const uStations = gl.getUniformLocation(program, "u_stations");
			const uAqis = gl.getUniformLocation(program, "u_aqis");

			if (
				!uLatMin ||
				!uLatMax ||
				!uLngMin ||
				!uLngMax ||
				!uViewport ||
				!uStations ||
				!uAqis
			) {
				console.warn("[AQI] render skipped — missing uniform locations");
				return true;
			}

			// Save WebGL state
			const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
			const prevBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
			const blendEnabled = gl.isEnabled(gl.BLEND);
			const prevBlendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
			const prevBlendDst = gl.getParameter(gl.BLEND_DST_RGB);
			const depthEnabled = gl.isEnabled(gl.DEPTH_TEST);

			// Set up our state
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.disable(gl.DEPTH_TEST);
			// biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL API, not a React hook
			gl.useProgram(program);

			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(aPosLoc);
			gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

			// Set uniforms
			gl.uniform1f(uLatMin, bounds.getSouth());
			gl.uniform1f(uLatMax, bounds.getNorth());
			gl.uniform1f(uLngMin, bounds.getWest());
			gl.uniform1f(uLngMax, bounds.getEast());
			gl.uniform2f(uViewport, canvas.width, canvas.height);

			const stationArr = new Float32Array(12);
			const aqiArr = new Float32Array(6);
			for (const [i, s] of fieldStations.entries()) {
				stationArr[i * 2] = s.lat;
				stationArr[i * 2 + 1] = s.lng;
				aqiArr[i] = s.aqi;
			}
			gl.uniform2fv(uStations, stationArr);
			gl.uniform1fv(uAqis, aqiArr);

			// Draw full-screen triangle
			gl.drawArrays(gl.TRIANGLES, 0, 3);

			// Restore WebGL state
			// biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL API, not a React hook
			gl.useProgram(prevProgram as WebGLProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, prevBuffer as WebGLBuffer);
			if (aPosLoc >= 0) gl.disableVertexAttribArray(aPosLoc);
			if (!blendEnabled) gl.disable(gl.BLEND);
			gl.blendFunc(prevBlendSrc, prevBlendDst);
			if (depthEnabled) gl.enable(gl.DEPTH_TEST);

			return true;
		},

		onRemove(_map: MapLibreMap, gl: WebGLRenderingContext) {
			console.log("[AQI] onRemove called");
			if (program) {
				gl.deleteProgram(program);
				program = null;
			}
			if (buffer) {
				gl.deleteBuffer(buffer);
				buffer = null;
			}
			mapInstance = null;
		},
	};
}
