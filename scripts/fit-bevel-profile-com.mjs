/**
 * Scratch tooling (not committed): fits `BEVEL_PROFILE_HEIGHT_MAP`'s
 * blurFactor/morphologyFactor/surfaceScaleFactor per `a:bevelT/@prst`
 * profile against the COM-measured cross-section brightness curves from
 * `measure-bevel-profile-com.ps1`.
 *
 * This does NOT drive a headless browser: launching Chromium/headless-shell
 * via Playwright hangs indefinitely in this environment (the child process
 * spawns per Task Manager/`Get-CimInstance`, but the `--remote-debugging-pipe`
 * CDP handshake never completes; observed for both the headless-shell and
 * full-chromium executables, `--no-sandbox` included). Instead this
 * reimplements the SAME primitive chain
 * (`visual-3d-bevel-lighting.ts`'s `renderLayerPrimitives`, single top-only
 * stage) analytically, evaluated along the straight-edge cross-section the
 * COM sample line itself uses (shape horizontal center, far from corners, so
 * curvature is negligible and the alpha silhouette is a 1-D step edge):
 *
 * - `feGaussianBlur in="SourceAlpha"` on a step edge is exactly the Gaussian
 *   CDF: blurredAlpha(d) = 0.5*(1+erf(d/(sigma*sqrt2))), d = px inward from
 *   the true edge (this is the standard closed-form result of convolving a
 *   step function with a Gaussian kernel, and is what the spec's own
 *   three-box-blur approximation targets).
 * - `feMorphology operator="erode"` (a min-filter of radius r) applied to a
 *   MONOTONIC NON-DECREASING function equals a plain shift: eroded(d) =
 *   blurredAlpha(d - r), because the minimum over any window of a
 *   non-decreasing function is always its left endpoint.
 * - `feDiffuseLighting`/`feSpecularLighting` and the `feDistantLight`
 *   azimuth/elevation follow the SVG spec formulas directly (N from the
 *   height field's gradient via `surfaceScale`, L from azimuth/elevation,
 *   H = normalize(L + (0,0,1)) for specular), and the `multiply`/`screen`
 *   blend composites match the CSS Compositing spec formulas the production
 *   filter chain also relies on (browsers implement both to spec).
 *
 * Grid-searches (blurFactor, morphologyFactor, surfaceScaleFactor) per
 * profile x depth condition for the minimum RMSE against the measured curve.
 *
 *   bun run scripts/fit-bevel-profile-com.mjs <measuredJson> <outJson>
 */
import { readFile, writeFile } from 'node:fs/promises';

const measuredPath = process.argv[2];
const outPath = process.argv[3];
const measured = JSON.parse(await readFile(measuredPath, 'utf8'));

const EMU_PER_PX = 9525;
const emuPt = (pt) => Math.round(pt * 12700);
const avgDimPx = (depthPt) => emuPt(depthPt) / EMU_PER_PX;

// threePt / matte, matching the COM fixture's scene3d + prstMaterial.
const ELEVATION_DEG = 74;
const DIFFUSE_CONSTANT = 0.9;
const SPECULAR_CONSTANT = 0.02;
const SPECULAR_EXPONENT = 4;

const BLUR_GRID = [0.04, 0.08, 0.12, 0.18, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85];
const MORPH_GRID = [undefined, 0.06, 0.12, 0.18, 0.25, 0.32, 0.4, 0.5];
const SCALE_GRID = [0.2, 0.35, 0.5, 0.65, 0.8, 1.0, 1.2, 1.5];

/** erf via Abramowitz & Stegun 7.1.26 (max error ~1.5e-7). */
function erf(x) {
	const sign = x < 0 ? -1 : 1;
	const ax = Math.abs(x);
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;
	const t = 1 / (1 + p * ax);
	const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
	return sign * y;
}

/** Gaussian-blurred step edge (feGaussianBlur on SourceAlpha), d = px inward from the true edge. */
function blurredAlpha(d, sigma) {
	if (sigma <= 0) {
		return d >= 0 ? 1 : 0;
	}
	return 0.5 * (1 + erf(d / (sigma * Math.SQRT2)));
}

/** Central-difference derivative of blurredAlpha (after an optional erode shift) at d. */
function heightAndSlope(d, sigma, morphRadius) {
	const shift = morphRadius ?? 0;
	const h = (dd) => blurredAlpha(dd - shift, sigma);
	const eps = 0.05;
	const slope = (h(d + eps) - h(d - eps)) / (2 * eps);
	return { height: h(d), slope };
}

function normalize3(x, y, z) {
	const len = Math.sqrt(x * x + y * y + z * z) || 1;
	return [x / len, y / len, z / len];
}

/**
 * Brightness (0-255, matte white lighting-color so all channels equal) at
 * one cross-section offset `d` (px inward from the top edge), reproducing
 * `renderLayerPrimitives`'s single-stage chain: diffuse multiply-blended
 * over the base fill, then specular screen-blended on top.
 */
function renderPoint(d, { sigma, morphRadius, surfaceScale, azimuthDeg, baseGray255 }) {
	const { slope } = heightAndSlope(d, sigma, morphRadius);
	// Height field varies only along the inward (y) axis at this cross-section.
	const nx = -surfaceScale * 0;
	const ny = -surfaceScale * slope;
	const nz = 1;
	const [Nx, Ny, Nz] = normalize3(nx, ny, nz);

	const az = (azimuthDeg * Math.PI) / 180;
	const el = (ELEVATION_DEG * Math.PI) / 180;
	const Lx = Math.cos(az) * Math.cos(el);
	const Ly = Math.sin(az) * Math.cos(el);
	const Lz = Math.sin(el);

	const NdotL = Nx * Lx + Ny * Ly + Nz * Lz;
	const diffuse = Math.min(1, Math.max(0, DIFFUSE_CONSTANT * Math.max(0, NdotL)));

	const [Hx, Hy, Hz] = normalize3(Lx, Ly, Lz + 1);
	const NdotH = Nx * Hx + Ny * Hy + Nz * Hz;
	const specular = Math.min(
		1,
		Math.max(0, SPECULAR_CONSTANT * Math.max(0, NdotH) ** SPECULAR_EXPONENT),
	);

	const base = baseGray255 / 255;
	const afterDiffuse = base * diffuse; // multiply blend, alpha=1 diffuse layer
	const afterSpecular = afterDiffuse + specular - afterDiffuse * specular; // screen blend
	return Math.min(255, Math.max(0, afterSpecular * 255));
}

function rmse(a, b) {
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		sum += (a[i] - b[i]) ** 2;
	}
	return Math.sqrt(sum / a.length);
}

/** Group measured entries by profile so 6pt and 24pt fit jointly (one shared factor set per profile, matching production's single BEVEL_PROFILE_HEIGHT_MAP entry). */
const byProfile = new Map();
for (const entry of measured) {
	if (!byProfile.has(entry.profile)) {
		byProfile.set(entry.profile, []);
	}
	byProfile.get(entry.profile).push(entry);
}

const jointFitted = {};
for (const [profile, entries] of byProfile) {
	const azimuthDeg = profile === 'softRound' ? 90 : 270;
	let best;
	for (const blurFactor of BLUR_GRID) {
		for (const morphologyFactor of MORPH_GRID) {
			for (const surfaceScaleFactor of SCALE_GRID) {
				let sumSq = 0;
				let n = 0;
				for (const entry of entries) {
					const avgDim = avgDimPx(entry.depthPt);
					const sigma = Math.max(0.5, avgDim * blurFactor);
					const morphRadius =
						morphologyFactor !== undefined ? Math.max(0.3, avgDim * morphologyFactor) : undefined;
					const surfaceScale = Math.max(0.5, avgDim * surfaceScaleFactor);
					const baseGray255 = 200;
					const rawRendered = entry.offsetsIn.map((offIn) =>
						renderPoint(offIn * 96, { sigma, morphRadius, surfaceScale, azimuthDeg, baseGray255 }),
					);
					const renderedFlat = rawRendered.at(-1) || 1;
					const measuredFlat = entry.brightness.at(-1);
					const rendered = rawRendered.map((v) => (v / renderedFlat) * measuredFlat);
					for (let i = 0; i < rendered.length; i++) {
						sumSq += (rendered[i] - entry.brightness[i]) ** 2;
						n++;
					}
				}
				const err = Math.sqrt(sumSq / n);
				if (!best || err < best.err) {
					best = { blurFactor, morphologyFactor, surfaceScaleFactor, err };
				}
			}
		}
	}
	jointFitted[profile] = best;
	console.log(
		`JOINT ${profile}: err=${best.err.toFixed(2)} blur=${best.blurFactor} morph=${best.morphologyFactor} scale=${best.surfaceScaleFactor}`,
	);
}

const fitted = {};
for (const entry of measured) {
	const key = `${entry.profile}|${entry.depthPt}`;
	const avgDim = avgDimPx(entry.depthPt);
	const azimuthDeg = entry.profile === 'softRound' ? 90 : 270;
	// This model's own flat-interior response is NOT 1 (it dims by
	// diffuseConstant*sin(elevationDeg), a SEPARATE, already-documented
	// defect -- see visual-3d-bevel-lighting-material.ts's module doc
	// comment on the washed-out-interior issue this campaign's item 2
	// targets). Item 1 is about the RAMP SHAPE only, so each rendered curve
	// is normalised by its OWN flat-tail value and rescaled to the measured
	// curve's flat-tail level before scoring, isolating the profile's
	// relative relief shape from that unrelated baseline-dimming defect.
	const measuredFlat = entry.brightness.at(-1);
	let best;
	for (const blurFactor of BLUR_GRID) {
		for (const morphologyFactor of MORPH_GRID) {
			for (const surfaceScaleFactor of SCALE_GRID) {
				const sigma = Math.max(0.5, avgDim * blurFactor);
				const morphRadius =
					morphologyFactor !== undefined ? Math.max(0.3, avgDim * morphologyFactor) : undefined;
				const surfaceScale = Math.max(0.5, avgDim * surfaceScaleFactor);
				const baseGray255 = 200; // arbitrary reference; normalised out below.
				const rawRendered = entry.offsetsIn.map((offIn) =>
					renderPoint(offIn * 96, {
						sigma,
						morphRadius,
						surfaceScale,
						azimuthDeg,
						baseGray255,
					}),
				);
				const renderedFlat = rawRendered.at(-1) || 1;
				const rendered = rawRendered.map((v) => (v / renderedFlat) * measuredFlat);
				const err = rmse(rendered, entry.brightness);
				if (!best || err < best.err) {
					best = { blurFactor, morphologyFactor, surfaceScaleFactor, err };
				}
			}
		}
	}
	fitted[key] = best;
	console.log(
		`${key}: err=${best.err.toFixed(2)} blur=${best.blurFactor} morph=${best.morphologyFactor} scale=${best.surfaceScaleFactor}`,
	);
}

await writeFile(outPath, JSON.stringify({ perDepth: fitted, joint: jointFitted }, null, 2));
console.log(`wrote ${outPath}`);
