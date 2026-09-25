/**
 * Scores the viewer's WordArt `can` rendering against the PowerPoint COM
 * exports written by `measure-wordart-can-com.ps1` (docs/guide/visual-effects.md,
 * "WordArt envelope glyph-outline warping").
 *
 * Drives headless Chromium against a running demo (the vanilla demo resolves
 * `pptx-viewer-shared` from SOURCE, so a shared edit is measured on the next
 * run without a build), uploads the deck from `make-wordart-can-fixture.ts`,
 * screenshots the main slide stage for every slide, and compares each against
 * its COM export at the COM export's own size (1920x1080 by default).
 *
 * Network is sandboxed: the Google Fonts CSS request for `Noto Sans` is
 * answered with an `@font-face` pointing at the locally installed
 * `NotoSans-{Regular,Bold}.ttf`, so the viewer parses the SAME font file
 * PowerPoint draws (the font-file outline path); every other catalogue
 * request (e.g. Arial's metric clone Arimo) gets an empty stylesheet, so
 * Arial and Verdana take the traced-outline path over the system font.
 *
 * Metrics, per slide, on binary ink masks (luminance < 128) at the COM size:
 *   - `iou`: |viewer AND com| / |viewer OR com|.
 *   - `meanPx` / `p95Px`: symmetric contour distance: every boundary pixel of
 *     either mask, its Euclidean distance to the nearest boundary pixel of the
 *     other mask; mean and 95th percentile over the pooled set.
 *   - `bestShift`: the integer (dx, dy) in [-12, 12] maximising IoU, and the
 *     IoU there, to separate a rigid offset from a shape error.
 *
 *   node scripts/measure-wordart-can-viewer.mjs <metaJson> <deck.pptx> <comDir> <outDir> [baseURL]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { chromium } from '@playwright/test';

const [metaPath, deckPath, comDir, outDir, baseURL = 'http://localhost:4676'] =
	process.argv.slice(2);
if (!metaPath || !deckPath || !comDir || !outDir) {
	throw new Error(
		'usage: measure-wordart-can-viewer.mjs <metaJson> <deck.pptx> <comDir> <outDir> [baseURL]',
	);
}
const meta = JSON.parse(await readFile(metaPath, 'utf8'));
await mkdir(outDir, { recursive: true });

const FONT_DIR = 'C:/Windows/Fonts';
const NOTO_CSS = [400, 700]
	.map(
		(w) =>
			`@font-face { font-family: 'Noto Sans'; font-style: normal; font-weight: ${w}; src: url(https://fonts.gstatic.com/pptx-local/${w}.ttf) format('truetype'); unicode-range: U+0000-00FF; }`,
	)
	.join('\n');

const DSF = 2;
const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1600, height: 1000 },
	deviceScaleFactor: DSF,
});
let fontFileHits = 0;
await context.route('https://fonts.googleapis.com/**', (route) => {
	const url = decodeURIComponent(route.request().url());
	const css = /Noto\+Sans|Noto Sans/u.test(url) ? NOTO_CSS : '';
	return route.fulfill({ status: 200, contentType: 'text/css', body: css });
});
await context.route('https://fonts.gstatic.com/**', async (route) => {
	const url = route.request().url();
	const file = url.endsWith('/700.ttf') ? 'NotoSans-Bold.ttf' : 'NotoSans-Regular.ttf';
	fontFileHits += 1;
	return route.fulfill({
		status: 200,
		contentType: 'font/ttf',
		headers: { 'access-control-allow-origin': '*' },
		body: await readFile(`${FONT_DIR}/${file}`),
	});
});
const page = await context.newPage();
await page.goto(baseURL);
await page.locator('#file-input').setInputFiles(deckPath);
await page.locator('[aria-roledescription="slide"]').first().waitFor();
await page.locator('[data-pptx-viewport] [data-element-id]').first().waitFor();
await page.mouse.move(0, 0);
// Embedded-font decoding and the first webfont round-trip land after first paint.
await page.waitForTimeout(2500);

/** In-page scorer: decodes both PNGs, thresholds, and computes the metrics. */
async function score({ viewerB64, comB64, w, h, src }) {
	const load = (b64) =>
		new Promise((ok, fail) => {
			const img = new Image();
			img.onload = () => ok(img);
			img.onerror = fail;
			img.src = `data:image/png;base64,${b64}`;
		});
	let vi = null;
	const mask = (img) => {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		const ctx = c.getContext('2d');
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, w, h);
		const r = img === vi ? src : { x: 0, y: 0, w: img.width, h: img.height };
		ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, w, h);
		const d = ctx.getImageData(0, 0, w, h).data;
		const m = new Uint8Array(w * h);
		for (let i = 0; i < w * h; i++) {
			m[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2] < 128 ? 1 : 0;
		}
		return m;
	};
	const boundary = (m) => {
		const b = new Uint8Array(w * h);
		for (let y = 1; y < h - 1; y++) {
			for (let x = 1; x < w - 1; x++) {
				const i = y * w + x;
				if (m[i] && (!m[i - 1] || !m[i + 1] || !m[i - w] || !m[i + w])) {
					b[i] = 1;
				}
			}
		}
		return b;
	};
	// Felzenszwalb-Huttenlocher exact squared Euclidean distance transform.
	const edt = (b) => {
		const INF = 1e12;
		const f = new Float64Array(Math.max(w, h));
		const dist = new Float64Array(w * h);
		const v = new Int32Array(Math.max(w, h));
		const z = new Float64Array(Math.max(w, h) + 1);
		const d1 = (n) => {
			const out = new Float64Array(n);
			let k = 0;
			v[0] = 0;
			z[0] = -INF;
			z[1] = INF;
			for (let q = 1; q < n; q++) {
				let s;
				for (;;) {
					s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
					if (s <= z[k]) {
						k--;
					} else {
						break;
					}
				}
				k++;
				v[k] = q;
				z[k] = s;
				z[k + 1] = INF;
			}
			k = 0;
			for (let q = 0; q < n; q++) {
				while (z[k + 1] < q) {
					k++;
				}
				out[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
			}
			return out;
		};
		for (let x = 0; x < w; x++) {
			for (let y = 0; y < h; y++) {
				f[y] = b[y * w + x] ? 0 : INF;
			}
			const col = d1(h);
			for (let y = 0; y < h; y++) {
				dist[y * w + x] = col[y];
			}
		}
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				f[x] = dist[y * w + x];
			}
			const row = d1(w);
			for (let x = 0; x < w; x++) {
				dist[y * w + x] = Math.sqrt(row[x]);
			}
		}
		return dist;
	};
	vi = await load(viewerB64);
	const ci = await load(comB64);
	const mv = mask(vi);
	const mc = mask(ci);
	const iouAt = (dx, dy) => {
		let inter = 0;
		let uni = 0;
		for (let y = 0; y < h; y++) {
			const ys = y - dy;
			for (let x = 0; x < w; x++) {
				const xs = x - dx;
				const a = xs >= 0 && xs < w && ys >= 0 && ys < h ? mv[ys * w + xs] : 0;
				const c = mc[y * w + x];
				inter += a & c;
				uni += a | c;
			}
		}
		return uni > 0 ? inter / uni : 1;
	};
	const bv = boundary(mv);
	const bc = boundary(mc);
	const dv = edt(bv);
	const dc = edt(bc);
	const ds = [];
	for (let i = 0; i < w * h; i++) {
		if (bv[i]) {
			ds.push(dc[i]);
		}
		if (bc[i]) {
			ds.push(dv[i]);
		}
	}
	ds.sort((a, b) => a - b);
	const mean = ds.reduce((s, d) => s + d, 0) / Math.max(1, ds.length);
	const p95 = ds[Math.floor(ds.length * 0.95)] ?? 0;
	let best = { dx: 0, dy: 0, iou: iouAt(0, 0) };
	const iou0 = best.iou;
	for (let step = 4; step >= 1; step = Math.floor(step / 2)) {
		const c = best;
		for (let dy = -step; dy <= step; dy += step) {
			for (let dx = -step; dx <= step; dx += step) {
				if (Math.abs(c.dx + dx) > 12 || Math.abs(c.dy + dy) > 12) {
					continue;
				}
				const s = iouAt(c.dx + dx, c.dy + dy);
				if (s > best.iou) {
					best = { dx: c.dx + dx, dy: c.dy + dy, iou: s };
				}
			}
		}
		if (step === 1) {
			break;
		}
	}
	const bbox = (m) => {
		let x0 = w;
		let x1 = -1;
		let y0 = h;
		let y1 = -1;
		let n = 0;
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				if (m[y * w + x]) {
					n++;
					x0 = Math.min(x0, x);
					x1 = Math.max(x1, x);
					y0 = Math.min(y0, y);
					y1 = Math.max(y1, y);
				}
			}
		}
		return { x0, x1, y0, y1, ink: n };
	};
	return {
		iou: iou0,
		meanPx: mean,
		p95Px: p95,
		bestShift: best,
		viewerBox: bbox(mv),
		comBox: bbox(mc),
	};
}

const results = [];
/**
 * The main slide stage: the LARGEST `aria-roledescription="slide"` element.
 * Thumbnails carry the same role, and while the main stage re-mounts on a
 * slide change a plain `.first()` can resolve to slide 1's thumbnail.
 */
const mainStage = async () => {
	const all = page.locator('[aria-roledescription="slide"]');
	const widths = await all.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
	return all.nth(widths.indexOf(Math.max(...widths)));
};
const seenSignatures = new Set();
for (const slide of meta.slides) {
	let signature = '';
	let stage = await mainStage();
	// Retry the navigation if the stage settles on a slide already measured
	// (every slide in the deck draws a distinct outline).
	for (let attempt = 0; attempt < 3; attempt++) {
		await page
			.getByRole('button', { name: new RegExp(`^Go to slide ${slide.index}$`, 'iu') })
			.click();
		await page.mouse.move(0, 0);
		await page.waitForFunction(() => document.fonts.status === 'loaded');
		// Wait until the stage's glyph paths stop changing, so neither a
		// half-mounted slide nor a pre-webfont first paint is scored.
		signature = '';
		for (let tries = 0, stable = 0; tries < 60 && stable < 3; tries++) {
			await page.waitForTimeout(150);
			stage = await mainStage();
			const next = await stage.evaluate((el) =>
				[...el.querySelectorAll('svg path')].map((p) => p.getAttribute('d') ?? '').join('|'),
			);
			stable = next !== '' && next === signature ? stable + 1 : 0;
			signature = next;
		}
		if (!seenSignatures.has(signature)) {
			break;
		}
	}
	seenSignatures.add(signature);
	// Clip to whole CSS pixels around the stage, then map its exact (sub-pixel)
	// rect onto the COM size when scoring, so a fractional fit scale cannot
	// shift or stretch the comparison.
	const rect = await stage.evaluate((el) => {
		const r = el.getBoundingClientRect();
		return { x: r.x, y: r.y, width: r.width, height: r.height };
	});
	const clip = {
		x: Math.floor(rect.x),
		y: Math.floor(rect.y),
		width: Math.ceil(rect.x + rect.width) - Math.floor(rect.x),
		height: Math.ceil(rect.y + rect.height) - Math.floor(rect.y),
	};
	const shot = await page.screenshot({ clip });
	const src = {
		x: (rect.x - clip.x) * DSF,
		y: (rect.y - clip.y) * DSF,
		w: rect.width * DSF,
		h: rect.height * DSF,
	};
	await writeFile(resolve(outDir, `slide${slide.index}.png`), shot);
	const com = await readFile(resolve(comDir, `slide${slide.index}.png`));
	const r = await page.evaluate(score, {
		viewerB64: shot.toString('base64'),
		comB64: com.toString('base64'),
		w: 1920,
		h: 1080,
		src,
	});
	const row = { ...slide, ...r, pathChars: signature.length };
	results.push(row);
	// oxlint-disable-next-line no-console -- measurement CLI output
	console.log(
		`${String(slide.index).padStart(2)} ${slide.font.padEnd(9)} ${slide.prst.padEnd(11)} ${String(slide.adj).padStart(5)} ${slide.text.padEnd(13)} IoU ${r.iou.toFixed(3)} mean ${r.meanPx.toFixed(2)} p95 ${r.p95Px.toFixed(2)} shift(${r.bestShift.dx},${r.bestShift.dy})->${r.bestShift.iou.toFixed(3)} d=${signature.length}`,
	);
}
await writeFile(
	resolve(outDir, 'results.json'),
	JSON.stringify({ fontFileHits, results }, null, 2),
);
// oxlint-disable-next-line no-console -- measurement CLI output
console.log(`font-file requests served: ${fontFileHits}`);
await browser.close();
