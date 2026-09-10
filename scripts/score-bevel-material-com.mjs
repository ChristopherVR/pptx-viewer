/**
 * Scratch tooling (not committed): scores the bevel lighting SVG filter
 * (item-1-fitted profile table, with and WITHOUT a candidate specular band
 * mask) against fresh COM ground truth for the item-2 (metal/circle
 * specular-masking) re-score -- the FULL 32-condition campaign (4 profiles x
 * 4 directions x matte/metal), fresh COM data via
 * `make-bevel-material-fixture.mjs` +
 * `measure-bevel-material-com.ps1`.
 *
 * Reuses REAL production functions (`resolveLayer` for filter parameters --
 * which itself reads the just-updated `BEVEL_PROFILE_HEIGHT_MAP` and
 * `MATERIAL_LIGHTING` -- and `getBevelHighlightDirection`/
 * `isBevelProfileInverted` to pick the correct highlight/shadow edge per
 * direction), so this only reimplements the numeric light-transport MATH the
 * production code only ever emits as SVG markup strings for (no
 * headless-browser rasterisation available in this environment; see
 * `fit-bevel-profile-com.mjs`'s doc comment for why, and the closed-form
 * derivation this reuses).
 *
 *   bun run scripts/score-bevel-material-com.mjs <measuredJson>
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const REPO = new URL('../', import.meta.url);
const importFrom = (p) => import(pathToFileURL(new URL(p, REPO).pathname).href);

const { resolveLayer } = await importFrom(
	'packages/shared/src/render/visual-3d-bevel-lighting-layer.ts',
);
const { getBevelHighlightDirection, isBevelProfileInverted } = await importFrom(
	'packages/shared/src/render/visual-3d-bevel-light.ts',
);

const measuredPath = process.argv[2];
const measured = JSON.parse(await readFile(measuredPath, 'utf8'));

function erf(x) {
	const sign = x < 0 ? -1 : 1;
	const ax = Math.abs(x);
	const a1 = 0.254829592,
		a2 = -0.284496736,
		a3 = 1.421413741,
		a4 = -1.453152027,
		a5 = 1.061405429,
		p = 0.3275911;
	const t = 1 / (1 + p * ax);
	const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
	return sign * y;
}
function blurredAlpha(d, sigma) {
	if (sigma <= 0) {
		return d >= 0 ? 1 : 0;
	}
	return 0.5 * (1 + erf(d / (sigma * Math.SQRT2)));
}
function heightAt(d, sigma, morphRadius) {
	return blurredAlpha(d - (morphRadius ?? 0), sigma);
}
function slopeAt(d, sigma, morphRadius) {
	const eps = 0.05;
	return (
		(heightAt(d + eps, sigma, morphRadius) - heightAt(d - eps, sigma, morphRadius)) / (2 * eps)
	);
}
function normalize3(x, y, z) {
	const len = Math.sqrt(x * x + y * y + z * z) || 1;
	return [x / len, y / len, z / len];
}
/** Triangle-of-height band mask: 1 at height=0.5 (mid-ramp), 0 at height=0 or 1 (flat). */
function bandMaskAt(d, sigma, morphRadius) {
	const h = heightAt(d, sigma, morphRadius);
	return 1 - Math.abs(2 * h - 1);
}

/** Outward unit vector for each of the 4 cardinal edges, same convention as `visual-3d-bevel-light`. */
const EDGE_OUTWARD = {
	top: { x: 0, y: -1 },
	right: { x: 1, y: 0 },
	bottom: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
};

/**
 * Brightness (0-255) at cross-section offset `d` (px inward from `edge`),
 * reproducing the production single-stage primitive chain exactly (same
 * layer params `resolveLayer` computes: `layer.azimuthDeg` is a FIXED
 * global-light property, never rotated per edge -- the edge's own outward
 * vector determines the local surface normal's (Nx,Ny) instead), with an
 * optional specular band mask (the item-2 candidate fix).
 */
function renderEdgePoint(d, layer, edge, useMask) {
	const slope = slopeAt(d, layer.blurStdDev, layer.morphologyRadius);
	const out = EDGE_OUTWARD[edge];
	const nx = layer.surfaceScale * slope * out.x;
	const ny = layer.surfaceScale * slope * out.y;
	const nz = 1;
	const [Nx, Ny, Nz] = normalize3(nx, ny, nz);

	const az = (layer.azimuthDeg * Math.PI) / 180;
	const el = (layer.elevationDeg * Math.PI) / 180;
	const Lx = Math.cos(az) * Math.cos(el);
	const Ly = Math.sin(az) * Math.cos(el);
	const Lz = Math.sin(el);

	const NdotL = Nx * Lx + Ny * Ly + Nz * Lz;
	const diffuse = Math.min(1, Math.max(0, layer.diffuseConstant * Math.max(0, NdotL)));

	const [Hx, Hy, Hz] = normalize3(Lx, Ly, Lz + 1);
	const NdotH = Nx * Hx + Ny * Hy + Nz * Hz;
	let specular = Math.min(
		1,
		Math.max(0, layer.specularConstant * Math.max(0, NdotH) ** layer.specularExponent),
	);
	if (useMask) {
		specular *= bandMaskAt(d, layer.blurStdDev, layer.morphologyRadius);
	}

	const base = 128 / 255; // SourceGraphic fill: a:srgbClr val="808080".
	const afterDiffuse = base * diffuse;
	const afterSpecular = afterDiffuse + specular - afterDiffuse * specular;
	return Math.min(255, Math.max(0, afterSpecular * 255));
}

const SAMPLE_OFFSET_PX = 0.15 * 96;
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/** Which edge is the highlight for (profile, dir), matching production's own direction mapping exactly. */
function highlightEdgeOf(profile, dir) {
	let v = getBevelHighlightDirection(dir);
	if (isBevelProfileInverted(profile)) {
		v = { dx: -v.dx, dy: -v.dy };
	}
	if (v.dy === -1) {
		return 'top';
	}
	if (v.dy === 1) {
		return 'bottom';
	}
	if (v.dx === 1) {
		return 'right';
	}
	return 'left';
}

function scoreCondition(m, useMask) {
	const layer = resolveLayer(
		0,
		m.profile,
		304800,
		304800,
		false,
		{ lightRigType: 'threePt', lightRigDirection: m.dir },
		m.material,
	);
	const hlEdge = highlightEdgeOf(m.profile, m.dir);
	const shEdge = OPPOSITE[hlEdge];
	const comHl = m[hlEdge];
	const comSh = m[shEdge];
	const renderedHl = renderEdgePoint(SAMPLE_OFFSET_PX, layer, hlEdge, useMask);
	const renderedSh = renderEdgePoint(SAMPLE_OFFSET_PX, layer, shEdge, useMask);
	const errHl = Math.abs(renderedHl - comHl);
	const errSh = Math.abs(renderedSh - comSh);
	return { hlEdge, shEdge, comHl, comSh, renderedHl, renderedSh, mean: (errHl + errSh) / 2 };
}

console.log(
	'profile      material  dir  hl/sh edge   COM(hl/sh)   unmasked(hl/sh, err)      masked(hl/sh, err)',
);
const groups = { matte: {}, metal: {} };
for (const m of measured) {
	const unmasked = scoreCondition(m, false);
	const masked = scoreCondition(m, true);
	(groups[m.material][m.profile] ??= []).push({ unmasked, masked });
	console.log(
		`${
			`${m.profile.padEnd(12)} ${m.material.padEnd(8)} ${m.dir.padEnd(4)} ${unmasked.hlEdge}/${unmasked.shEdge}`.padEnd(
				38,
			) +
			`${unmasked.comHl.toFixed(0)}/${unmasked.comSh.toFixed(0)}`.padEnd(13) +
			`${unmasked.renderedHl.toFixed(1)}/${unmasked.renderedSh.toFixed(1)} (${unmasked.mean.toFixed(1)})`.padEnd(
				26,
			)
		}${masked.renderedHl.toFixed(1)}/${masked.renderedSh.toFixed(1)} (${masked.mean.toFixed(1)})`,
	);
}

console.log('\n--- per-profile mean error (4 directions) ---');
for (const material of ['matte', 'metal']) {
	console.log(material);
	for (const [profile, rows] of Object.entries(groups[material])) {
		const meanUnmasked = rows.reduce((s, r) => s + r.unmasked.mean, 0) / rows.length;
		const meanMasked = rows.reduce((s, r) => s + r.masked.mean, 0) / rows.length;
		console.log(
			`  ${profile.padEnd(12)} unmasked=${meanUnmasked.toFixed(2)}  masked=${meanMasked.toFixed(2)}`,
		);
	}
	const all = Object.values(groups[material]).flat();
	const meanUnmasked = all.reduce((s, r) => s + r.unmasked.mean, 0) / all.length;
	const meanMasked = all.reduce((s, r) => s + r.masked.mean, 0) / all.length;
	console.log(
		`  ALL          unmasked=${meanUnmasked.toFixed(2)}  masked=${meanMasked.toFixed(2)}`,
	);
}
