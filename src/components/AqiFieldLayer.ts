import earcut from "earcut";
import type { Map as MapLibreMap } from "maplibre-gl";
import { fieldConfig, fieldStations } from "#/lib/aqi-field";
import { comunasRM } from "#/lib/comunas-rm";

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

uniform sampler2D u_mask;
uniform float u_use_mask;

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

    if (u_use_mask > 0.5) {
        vec2 maskUV = gl_FragCoord.xy / u_viewport;
        float mask = texture2D(u_mask, maskUV).r;
        if (mask < 0.5) {
            discard;
        }
    }

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

const MASK_VERTEX = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const MASK_FRAGMENT = `
precision highp float;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
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
	return program;
}

interface FBO {
	fbo: WebGLFramebuffer;
	texture: WebGLTexture;
	width: number;
	height: number;
}

function createFBO(gl: WebGLRenderingContext, w: number, h: number): FBO {
	const texture = gl.createTexture();
	if (!texture) throw new Error("Failed to create texture");
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		w,
		h,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		null,
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	const fbo = gl.createFramebuffer();
	if (!fbo) throw new Error("Failed to create framebuffer");
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(
		gl.FRAMEBUFFER,
		gl.COLOR_ATTACHMENT0,
		gl.TEXTURE_2D,
		texture,
		0,
	);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	return { fbo, texture, width: w, height: h };
}

function resizeFBO(
	gl: WebGLRenderingContext,
	fboInfo: FBO,
	w: number,
	h: number,
) {
	gl.bindTexture(gl.TEXTURE_2D, fboInfo.texture);
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA,
		w,
		h,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		null,
	);
	fboInfo.width = w;
	fboInfo.height = h;
}

function drawComunaMask(
	gl: WebGLRenderingContext,
	maskProgram: WebGLProgram,
	map: MapLibreMap,
	comunaName: string,
	maskBuffer: WebGLBuffer,
	maskIndexBuffer: WebGLBuffer,
) {
	const comuna = comunasRM.find((c) => c.name === comunaName);
	if (!comuna) return;

	const ring = comuna.coords[0];
	if (!ring) return;

	const dpr = window.devicePixelRatio || 1;
	const canvas = gl.canvas as HTMLCanvasElement;

	// Project GeoJSON [lng, lat] to screen pixels and then to NDC
	const vertices: number[] = [];
	for (const [lng, lat] of ring as [number, number][]) {
		const p = map.project([lng, lat]);
		const x = ((p.x * dpr) / canvas.width) * 2 - 1;
		const y = ((canvas.height - p.y * dpr) / canvas.height) * 2 - 1;
		vertices.push(x, y);
	}

	// Triangulate
	const flat = ring.flat();
	const indices = earcut(flat);
	if (indices.length === 0) return;

	const aPosLoc = gl.getAttribLocation(maskProgram, "a_pos");

	gl.bindBuffer(gl.ARRAY_BUFFER, maskBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
	gl.enableVertexAttribArray(aPosLoc);
	gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, maskIndexBuffer);
	gl.bufferData(
		gl.ELEMENT_ARRAY_BUFFER,
		new Uint16Array(indices),
		gl.DYNAMIC_DRAW,
	);

	gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
}

export function createAqiFieldLayer() {
	let program: WebGLProgram | null = null;
	let buffer: WebGLBuffer | null = null;
	let mapInstance: MapLibreMap | null = null;
	let renderCount = 0;

	// Mask resources
	let maskProgram: WebGLProgram | null = null;
	let maskFBO: FBO | null = null;
	let maskBuffer: WebGLBuffer | null = null;
	let maskIndexBuffer: WebGLBuffer | null = null;

	return {
		id: "aqi-field",
		type: "custom" as const,
		renderingMode: "2d" as const,

		onAdd(map: MapLibreMap, gl: WebGLRenderingContext) {
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

			// Mask setup
			maskProgram = createProgram(gl, MASK_VERTEX, MASK_FRAGMENT);
			if (!maskProgram) {
				console.error("[AQI] Failed to create mask shader program");
				return;
			}

			const canvas = gl.canvas as HTMLCanvasElement;
			maskFBO = createFBO(gl, canvas.width, canvas.height);
			maskBuffer = gl.createBuffer();
			maskIndexBuffer = gl.createBuffer();
		},

		render(gl: WebGLRenderingContext) {
			if (!mapInstance || !program || !buffer) {
				return true;
			}

			if (!fieldConfig.enabled) {
				return true;
			}

			renderCount++;
			if (renderCount <= 3) {
				console.log(`[AQI] render called (#${renderCount})`);
			}

			const bounds = mapInstance.getBounds();
			const canvas = gl.canvas as HTMLCanvasElement;

			// Resize mask FBO if canvas changed
			if (
				maskFBO &&
				(maskFBO.width !== canvas.width || maskFBO.height !== canvas.height)
			) {
				resizeFBO(gl, maskFBO, canvas.width, canvas.height);
			}

			// Render mask if comunas are selected
			const useMask =
				!!maskProgram &&
				!!maskFBO &&
				!!maskBuffer &&
				!!maskIndexBuffer &&
				fieldConfig.selectedComunas.length > 0;

			if (useMask && maskProgram && maskFBO && maskBuffer && maskIndexBuffer) {
				// Save state
				const prevFBO = gl.getParameter(gl.FRAMEBUFFER_BINDING);
				const prevProgram = gl.getParameter(gl.CURRENT_PROGRAM);
				const prevViewport = gl.getParameter(gl.VIEWPORT) as Int32Array | null;
				const blendEnabled = gl.isEnabled(gl.BLEND);
				const prevBlendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
				const prevBlendDst = gl.getParameter(gl.BLEND_DST_RGB);
				const prevArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
				const prevElementArrayBuffer = gl.getParameter(
					gl.ELEMENT_ARRAY_BUFFER_BINDING,
				);

				// Mask pass
				gl.bindFramebuffer(gl.FRAMEBUFFER, maskFBO.fbo);
				gl.viewport(0, 0, canvas.width, canvas.height);
				gl.clearColor(0.0, 0.0, 0.0, 1.0);
				gl.clear(gl.COLOR_BUFFER_BIT);
				gl.disable(gl.BLEND);
				// biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL API, not a React hook
				gl.useProgram(maskProgram);

				for (const comunaName of fieldConfig.selectedComunas) {
					drawComunaMask(
						gl,
						maskProgram,
						mapInstance,
						comunaName,
						maskBuffer,
						maskIndexBuffer,
					);
				}

				// Restore state
				gl.bindFramebuffer(gl.FRAMEBUFFER, prevFBO as WebGLFramebuffer);
				if (prevViewport) {
					gl.viewport(
						Number(prevViewport[0]),
						Number(prevViewport[1]),
						Number(prevViewport[2]),
						Number(prevViewport[3]),
					);
				}
				// biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL API, not a React hook
				gl.useProgram(prevProgram as WebGLProgram);
				gl.bindBuffer(gl.ARRAY_BUFFER, prevArrayBuffer as WebGLBuffer);
				gl.bindBuffer(
					gl.ELEMENT_ARRAY_BUFFER,
					prevElementArrayBuffer as WebGLBuffer,
				);
				if (blendEnabled) {
					gl.enable(gl.BLEND);
					gl.blendFunc(prevBlendSrc, prevBlendDst);
				}
			}

			// Get uniform locations
			const aPosLoc = gl.getAttribLocation(program, "a_pos");
			const uLatMin = gl.getUniformLocation(program, "u_lat_min");
			const uLatMax = gl.getUniformLocation(program, "u_lat_max");
			const uLngMin = gl.getUniformLocation(program, "u_lng_min");
			const uLngMax = gl.getUniformLocation(program, "u_lng_max");
			const uViewport = gl.getUniformLocation(program, "u_viewport");
			const uStations = gl.getUniformLocation(program, "u_stations");
			const uAqis = gl.getUniformLocation(program, "u_aqis");
			const uUseMask = gl.getUniformLocation(program, "u_use_mask");
			const uMask = gl.getUniformLocation(program, "u_mask");

			if (
				!uLatMin ||
				!uLatMax ||
				!uLngMin ||
				!uLngMax ||
				!uViewport ||
				!uStations ||
				!uAqis ||
				!uUseMask ||
				!uMask
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
			const prevTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
			const prevActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);

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

			gl.uniform1f(uUseMask, useMask ? 1.0 : 0.0);
			if (useMask && maskFBO) {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, maskFBO.texture);
				gl.uniform1i(uMask, 0);
			}

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
			gl.activeTexture(prevActiveTexture);
			gl.bindTexture(gl.TEXTURE_2D, prevTexture as WebGLTexture);

			return true;
		},

		onRemove(_map: MapLibreMap, gl: WebGLRenderingContext) {
			if (program) {
				gl.deleteProgram(program);
				program = null;
			}
			if (buffer) {
				gl.deleteBuffer(buffer);
				buffer = null;
			}
			if (maskProgram) {
				gl.deleteProgram(maskProgram);
				maskProgram = null;
			}
			if (maskFBO) {
				gl.deleteFramebuffer(maskFBO.fbo);
				gl.deleteTexture(maskFBO.texture);
				maskFBO = null;
			}
			if (maskBuffer) {
				gl.deleteBuffer(maskBuffer);
				maskBuffer = null;
			}
			if (maskIndexBuffer) {
				gl.deleteBuffer(maskIndexBuffer);
				maskIndexBuffer = null;
			}
			mapInstance = null;
		},
	};
}
