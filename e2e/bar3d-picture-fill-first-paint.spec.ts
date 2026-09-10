/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * `c:pictureOptions` on an untargeted `bar3D` extrusion face: PowerPoint
 * paints it a flat colour sampled from the picture's own pixel at (0,0),
 * COM-verified (see `packages/shared/src/render/chart-bar3d-face-picture.ts`'s
 * module doc). The renderer used to decode that pixel ONLY asynchronously
 * (`Image` + `<canvas>`), so the untargeted faces briefly painted the
 * fallback point/series colour before repainting once the decode resolved -
 * a first-render flash, and permanently wrong in a DOM-less render path.
 *
 * `packages/core/src/core/utils/image-first-pixel*.ts` now decodes PNG/GIF/
 * BMP/baseline-JPEG synchronously, and
 * `chart-bar3d-face-picture-sample.ts`'s `resolveBarFacePicturePixelColor`
 * tries that FIRST. This spec's fixture
 * (`bar3d-picture-fill.pptx`, `generate-bar3d-picture-fill-fixture.ts`) is a
 * single-series `bar3D` chart whose picture fill is a 2x2 PNG: pixel (0,0) is
 * GREEN (`#00ff00`), every OTHER pixel is RED - the same "majority colour is
 * a decoy" shape as the COM ground-truth fixture, so a renderer that
 * (incorrectly) averaged/centre-sampled the image, or still only decoded
 * asynchronously and read straight after load, would visibly fail this. The
 * series' front face is targeted (`c:applyToFront val="1"`, painted with the
 * picture pattern itself); the side and end faces are EXPLICITLY untargeted
 * (`c:applyToSides`/`c:applyToEnd` both `0`), so both must paint the
 * GREEN-derived tint/shade, never the chart's default series colour.
 *
 * The expected side/end colours are computed here with the SAME formula
 * `resolveUntargetedBarFaceFill` uses (`tint`/`shade` in
 * `chart-palette.ts`) rather than imported, since a Playwright spec runs
 * outside the workspace's module graph; a mismatch between the two would be
 * a real bug in ONE of them, not something to paper over by importing one
 * into the other.
 *
 * Run: bunx playwright test bar3d-picture-fill-first-paint
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';
import { fingerprintCharts } from './support/svg-fingerprint';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('bar3d-picture-fill.pptx');

/** Mirrors `chart-palette.ts`'s `hexToRgb`/`rgbToHex`/`tint`/`shade` exactly (see module doc). */
function tint([r, g, b]: [number, number, number], amount: number): [number, number, number] {
	return [r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount];
}
function shade([r, g, b]: [number, number, number], amount: number): [number, number, number] {
	return [r * (1 - amount), g * (1 - amount), b * (1 - amount)];
}
function toRgbString([r, g, b]: [number, number, number]): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}

const GREEN: [number, number, number] = [0, 255, 0];
/** `face === 'end'` -> tint(0.22); `face === 'side'` -> shade(0.25). */
const EXPECTED_END_FILL = toRgbString(tint(GREEN, 0.22));
const EXPECTED_SIDE_FILL = toRgbString(shade(GREEN, 0.25));

test.describe('bar3D untargeted picture-fill face colour (first paint, no flash)', () => {
	test('every binding paints the untargeted side/end faces from the picture, not the fallback series colour', async ({
		browser,
	}, testInfo) => {
		test.slow();

		const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
			await loadDeckAt(page, origin, FIXTURE);
			await slideStage(page).waitFor();
			await page
				.locator('[aria-roledescription="slide"] [aria-roledescription="chart"] svg')
				.first()
				.waitFor({ timeout: 20_000 });
			// Deliberately no extra wait/interaction beyond the chart existing:
			// this spec's whole point is what colour is ALREADY painted the
			// moment the chart is present, not what it eventually becomes.
			const charts = await fingerprintCharts(page);
			return charts;
		});

		const failures = results.flatMap(({ framework, value: charts }) => {
			if (charts.length === 0) {
				return [`${framework.name}: no chart rendered at all`];
			}
			const fills = new Set(charts[0].shapes.map((s) => s.fill));
			const problems: string[] = [];
			if (!fills.has(EXPECTED_END_FILL) && !fills.has(EXPECTED_SIDE_FILL)) {
				problems.push(
					`neither the tinted end-face fill (${EXPECTED_END_FILL}) nor the shaded ` +
						`side-face fill (${EXPECTED_SIDE_FILL}) is present - the untargeted faces ` +
						`did not pick up the picture's sampled pixel. Fills seen: ${[...fills].join(', ') || 'none'}`,
				);
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');
	});
});
