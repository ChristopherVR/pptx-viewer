/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * A freeform (`a:custGeom`) shape whose `a:gradFill` authors `a:path
 * path="rect"` - PowerPoint's "shade toward the shape's own rectangle"
 * gradient. Its isolines are concentric SQUARED rectangles (a Chebyshev
 * field), which SVG/CSS cannot express as a native `<radialGradient>` /
 * `radial-gradient()` without visibly rounding every corner, so
 * `packages/shared/src/render/path-gradient-rect.ts`'s `buildRectPathGradientSvg`
 * renders the true field directly as ~40 nested `<rect>` bands inside a small
 * self-contained SVG, embedded as a `data:image/svg+xml,...` URI.
 *
 * The two structural forms this fixture has to accept are BOTH correct, not a
 * parity gap: React paints structured custom geometry as an inline SVG rather
 * than a CSS box, so it wraps the URI in its own `<pattern><image>` paint
 * server (`svg-gradient-rect-path.ts`); the other four bindings paint the
 * shape as a CSS-clipped box and apply the exact same URI as a plain
 * `background-image`. Either way the URI is produced by the one shared
 * function, so its DECODED markup must be byte-identical everywhere - that
 * identity is what actually proves "pixel-identical", rather than a fragile
 * screenshot diff.
 *
 * Run: bunx playwright test rectpath-gradient
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('rectpath-gradient.pptx');

interface RectPathProbe {
	/** Which structural form was found: an SVG `<pattern>`/`<image>`, a CSS `background-image`, or neither. */
	kind: 'pattern' | 'background' | 'none';
	/** The decoded `data:image/svg+xml,...` markup, or `''` when `kind` is `'none'`. */
	markup: string;
	/** Number of `<rect` bands in the decoded markup (a plain radial/linear gradient would have 0). */
	rectBandCount: number;
	/** Whether ANY `<radialGradient` or `<linearGradient` paint server is used for this shape's fill. */
	usesNativeGradientElement: boolean;
}

async function readRectPathProbe(page: Page, origin: string): Promise<RectPathProbe> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForTimeout(200);

	return page.evaluate(() => {
		const decodeSvgDataUri = (raw: string): string => {
			const prefix = 'data:image/svg+xml,';
			const body = raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
			try {
				return decodeURIComponent(body);
			} catch {
				return body;
			}
		};

		const candidates = [
			...document.querySelectorAll<HTMLElement>('[aria-roledescription="slide"] *'),
		];

		// Case A: an SVG <pattern><image href="data:image/svg+xml,..."> (React's
		// inline-SVG custom-geometry path).
		for (const el of candidates) {
			if (el.tagName.toLowerCase() !== 'image') {
				continue;
			}
			const href = el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '';
			if (href.startsWith('data:image/svg+xml,') && el.closest('pattern')) {
				const markup = decodeSvgDataUri(href);
				return {
					kind: 'pattern' as const,
					markup,
					rectBandCount: [...markup.matchAll(/<rect\b/gu)].length,
					usesNativeGradientElement:
						document.querySelector('radialGradient, linearGradient') !== null,
				};
			}
		}

		// Case B: a plain CSS `background-image: url("data:image/svg+xml,...")`
		// on the shape's own box or a descendant paint layer.
		for (const el of candidates) {
			const bg = getComputedStyle(el).backgroundImage;
			const match = /url\(["']?(data:image\/svg\+xml[^"')]+)["']?\)/u.exec(bg);
			if (match) {
				const markup = decodeSvgDataUri(match[1]);
				return {
					kind: 'background' as const,
					markup,
					rectBandCount: [...markup.matchAll(/<rect\b/gu)].length,
					usesNativeGradientElement:
						document.querySelector('radialGradient, linearGradient') !== null,
				};
			}
		}

		return {
			kind: 'none' as const,
			markup: '',
			rectBandCount: 0,
			usesNativeGradientElement: false,
		};
	});
}

test.describe('freeform path="rect" gradient', () => {
	test('every binding paints the true nested-rect field, byte-identically', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readRectPathProbe);

		const failures: string[] = [];
		for (const { framework, value } of results) {
			if (value.kind === 'none') {
				failures.push(
					`${framework.name}: no <pattern>/<image> or CSS background-image data URI found - the gradient did not render at all`,
				);
				continue;
			}
			if (value.rectBandCount < 10) {
				failures.push(
					`${framework.name}: decoded markup has only ${value.rectBandCount} <rect> band(s) - expected the nested-rect field (~40 bands), not a flattened approximation`,
				);
			}
		}

		const [reference, ...rest] = results;
		for (const candidate of rest) {
			if (
				candidate.value.kind !== 'none' &&
				reference.value.kind !== 'none' &&
				candidate.value.markup !== reference.value.markup
			) {
				failures.push(
					`${candidate.framework.name}: decoded gradient markup differs from ${reference.framework.name}'s ` +
						`(lengths ${candidate.value.markup.length} vs ${reference.value.markup.length})`,
				);
			}
		}

		expect(failures.join('\n')).toBe('');
	});
});
