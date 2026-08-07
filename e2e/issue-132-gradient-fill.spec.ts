/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Regression coverage for issue #132, run identically against every framework
 * demo.
 *
 * The reporter filed "gradient fill (a:gradFill) renders as solid color, losing
 * transparency" and quoted one element:
 *
 *   data-element-id="...-shape-4"  aria-label="Shape: parallelogram"
 *   left: 59px; top: 0px; width: 521px; height: 720px;
 *   background-color: rgb(210, 248, 244);
 *
 * That is `ppt/slides/slide2.xml-shape-4` in their deck
 * (`e2e/fixtures/issue-132-gradient-fill.pptx`, a media-slimmed copy of the
 * attachment). Reading the deck settled what was actually broken:
 *
 *  1. The quoted shape has no gradient at all - it is a solid
 *     `accent2 lumMod 20% lumOff 80%`, which resolves to exactly
 *     `rgb(210,248,244)`. Its defect is the OUTLINE: a `parallelogram` authored
 *     at `adj="84929"` is a thin diagonal band, and the clip-path cascade served
 *     the preset's DEFAULT `adj="25000"` polygon (80% of the box). The slab
 *     occluded the slide's text, which is what the report describes as the
 *     shape "visually overlapping / occluding content beneath it". Every preset
 *     with an authored `a:avLst` outside the 14 dynamically-modelled shapes was
 *     affected the same way.
 *  2. Real gradients elsewhere in the deck exposed two genuine fidelity gaps:
 *     the tile offset of PowerPoint's stock corner-radial preset
 *     (`a:tileRect l="-100000" t="-100000"`) was dropped, and React alone never
 *     applied `a:tileRect` / `@flip` at all.
 *
 * The freeform-gradient half of (2) - a `a:custGeom` shape painted as an SVG
 * `<path>` that cannot take a CSS gradient - is React-only and covered by
 * `packages/react/src/viewer/utils/vector-shape-renderer.gradient.test.tsx`.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { resetTabSession } from './support/deck';

const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/issue-132-gradient-fill.pptx', import.meta.url)),
);

/** 1-based slide numbers, named for what they demonstrate. */
const SLIDE = {
	/** The reporter's parallelogram, full-bleed over the slide's body text. */
	parallelogram: 2,
	/** Panels with linear `a:gradFill` fills, plus a themed vertical connector. */
	linearGradients: 3,
	/** Circle-path radial gradient with an oversized `a:tileRect`. */
	cornerRadial: 4,
	/** Percentage bar chart (`c:numFmt formatCode="0%"`, `c:spPr/a:noFill`). */
	percentChart: 5,
	/** Body text set in an uninstalled CJK sans. */
	uninstalledFont: 12,
	/** Elbows drawn from three zero-extent straight connectors. */
	zeroExtentConnectors: 25,
	/** Full-width `rightArrow` shapes (`8792048 x 256208` EMU). */
	longArrows: 26,
} as const;

const LOAD_TIMEOUT_MS = 60_000;

async function loadDeck(page: Page): Promise<void> {
	await page.setViewportSize({ width: 1600, height: 1000 });
	// Forget any restored session first, or the deck reopens and the landing
	// dropzone (the only place #file-input exists) never mounts.
	await resetTabSession(page);
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(fixturePath);
	await page.locator('[aria-label="Go to slide 29"]').first().waitFor({ timeout: LOAD_TIMEOUT_MS });
	await page.waitForTimeout(1200);
}

async function gotoSlide(page: Page, slideNumber: number): Promise<void> {
	await page.locator(`[aria-label="Go to slide ${slideNumber}"]`).first().click();
	await page.waitForTimeout(900);
}

/**
 * Computed geometry + paint for one element id, measured on the largest rendered
 * copy so a slide-rail thumbnail can never win.
 */
async function paintOf(
	page: Page,
	elementIdSuffix: string,
): Promise<{
	width: number;
	height: number;
	clipPath: string;
	backgroundColor: string;
	backgroundImage: string;
	backgroundSize: string;
	backgroundPosition: string;
} | null> {
	return page.evaluate((suffix) => {
		let best: HTMLElement | undefined;
		let bestArea = 0;
		for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
			if (!(node.dataset.elementId ?? '').endsWith(suffix)) {
				continue;
			}
			const box = node.getBoundingClientRect();
			if (box.width * box.height > bestArea) {
				bestArea = box.width * box.height;
				best = node;
			}
		}
		if (!best) {
			return null;
		}
		const box = best.getBoundingClientRect();
		const style = getComputedStyle(best);
		return {
			width: box.width,
			height: box.height,
			clipPath: style.clipPath,
			backgroundColor: style.backgroundColor,
			backgroundImage: style.backgroundImage,
			backgroundSize: style.backgroundSize,
			backgroundPosition: style.backgroundPosition,
		};
	}, elementIdSuffix);
}

/**
 * Shoelace area of the polygon described by a `path('M … Z')` clip-path, as a
 * fraction of the box that path spans.
 *
 * Normalised against the path's OWN extent rather than the element's rendered
 * `getBoundingClientRect`: the slide stage is CSS-scaled to the viewport, so the
 * measured box shrinks while `clip-path` coordinates stay in the element's
 * authored slide-space pixels. Dividing by the rendered box mixes the two and
 * inflates the ratio by the square of the stage scale.
 */
function pathAreaFraction(clipPath: string): number {
	const points = [...clipPath.matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/gu)].map(([, x, y]) => [
		Number(x),
		Number(y),
	]);
	let twiceArea = 0;
	for (let index = 0; index < points.length; index += 1) {
		const [x1, y1] = points[index];
		const [x2, y2] = points[(index + 1) % points.length];
		twiceArea += x1 * y2 - x2 * y1;
	}
	const spanX = Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x));
	const spanY = Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y));
	return Math.abs(twiceArea / 2) / (spanX * spanY);
}

test.describe('issue #132 - gradient fill / preset adjustment fidelity', () => {
	test('the parallelogram is clipped to its authored adj, not the preset default', async ({
		page,
	}) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.parallelogram);

		const paint = await paintOf(page, 'slide2.xml-shape-4');
		expect(paint, 'found the reporter’s parallelogram').not.toBeNull();

		// The fill was never wrong: accent2 lumMod 20% / lumOff 80%.
		expect(paint?.backgroundColor).toBe('rgb(210, 248, 244)');

		// The default `polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)` is what made
		// the band read as a slab. Every binding resolves the preset through the
		// shared clip-path cascade, so all five must emit an evaluated path.
		expect(paint?.clipPath, 'preset geometry is evaluated, not table-defaulted').toContain('path(');
	});

	test('the parallelogram covers a band, not most of its box', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.parallelogram);

		const paint = await paintOf(page, 'slide2.xml-shape-4');
		expect(paint).not.toBeNull();

		// `adj="84929"` leaves 1 - 0.84929 of the box painted. The default
		// adjustment painted 0.8 of it, burying the slide's body text.
		const fraction = pathAreaFraction(paint!.clipPath);
		expect(fraction, 'painted area matches the authored skew').toBeCloseTo(1 - 0.84929, 2);
	});

	test('a gradFill shape paints a CSS gradient, not its representative solid', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.linearGradients);

		// `<a:gradFill><a:gs pos="0"><a:srgbClr val="CDAE71"/>…` top-to-bottom.
		const paint = await paintOf(page, 'slide3.xml-shape-4');
		expect(paint, 'found the gradient panel').not.toBeNull();
		expect(paint?.backgroundImage).toContain('linear-gradient');
		expect(paint?.backgroundImage).toContain('205, 174, 113');
		expect(paint?.backgroundImage).toContain('148, 113, 74');
	});

	test('a gradient OUTLINE is stroked, not flattened to one averaged colour', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.cornerRadial);

		// Slide 4's ellipse carries `<a:ln><a:gradFill>` running #F0FDFE -> #BFBFBF.
		// A CSS border takes one colour, so every binding painted the parser's
		// averaged #D8DEDF instead; the outline is now stroked as an SVG path over
		// the element, following the ellipse rather than its bounding box.
		const outline = await page.evaluate(() => {
			let host: HTMLElement | undefined;
			let best = 0;
			for (const node of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
				if (!(node.dataset.elementId ?? '').endsWith('slide4.xml-shape-3')) {
					continue;
				}
				const box = node.getBoundingClientRect();
				if (box.width * box.height > best) {
					best = box.width * box.height;
					host = node;
				}
			}
			if (!host) {
				return null;
			}
			const path = host.querySelector('svg path[stroke^="url("]');
			const gradient = host.querySelector('svg linearGradient, svg radialGradient');
			return {
				borderWidth: getComputedStyle(host).borderTopWidth,
				strokedPath: path?.getAttribute('d') ?? null,
				stopColors: [...(gradient?.querySelectorAll('stop') ?? [])].map((s) =>
					s.getAttribute('stop-color'),
				),
			};
		});

		expect(outline, 'found the gradient-outlined ellipse').not.toBeNull();
		expect(outline?.stopColors, 'both authored stops reach the paint server').toStrictEqual([
			'#F0FDFE',
			'#BFBFBF',
		]);
		// The outline follows the ellipse (arc commands), not a rectangle.
		expect(outline?.strokedPath).toContain('A ');
		// And the averaged solid border is gone, so it cannot show underneath.
		expect(Number.parseFloat(String(outline?.borderWidth))).toBe(0);
	});

	test('an oversized tileRect offsets the gradient tile off the shape', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.cornerRadial);

		// `<a:path path="circle"><a:fillToRect r="100000" b="100000"/>` with
		// `<a:tileRect l="-100000" t="-100000"/>`: a tile twice the shape, hung off
		// its top-left, so the focal corner sits outside the box.
		const paint = await paintOf(page, 'slide4.xml-shape-3');
		expect(paint, 'found the corner radial gradient').not.toBeNull();

		// A `circle` sized with a PERCENTAGE is invalid CSS (only a length is
		// legal), so the browser discarded the whole declaration and the shape
		// rendered with no fill at all. `getComputedStyle` reporting anything
		// other than `none` is the regression guard.
		expect(paint?.backgroundImage, 'the gradient is parseable CSS').toContain('radial-gradient');
		expect(paint?.backgroundImage).not.toMatch(/circle\s+[\d.]+%/u);

		// The tile is twice the shape and hangs off its top-left, so the tile's
		// far edges pin to the shape's: `200%` size at `100%` position. Dropping
		// the position (the bug) left the tile at `0 0` and dragged the focal blob
		// onto the shape's own corner.
		expect(paint?.backgroundSize).toBe('200% 200%');
		expect(paint?.backgroundPosition).toBe('100% 100%');
	});

	/**
	 * A `rightArrow` measures its head against `ss` (the SHORT side), so slide
	 * 26's 8792048 x 256208 EMU arrow is a hairline shaft with a small head.
	 * Scaling off `w` instead put the head halfway along the shape: every one of
	 * these arrows rendered as a huge elongated triangle.
	 */
	test('a long arrow keeps a small head, not one half its length', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.longArrows);

		const paint = await paintOf(page, 'slide26.xml-shape-4');
		expect(paint, 'found the full-width arrow').not.toBeNull();

		// The clip path spans the shape; the head starts at `r - ss`, so the
		// rightmost interior vertex sits within one short side of the tip.
		const xs = [...paint!.clipPath.matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/gu)].map(([, x]) =>
			Number(x),
		);
		const ys = [...paint!.clipPath.matchAll(/(-?[\d.]+)[ ,]+(-?[\d.]+)/gu)].map(([, , y]) =>
			Number(y),
		);
		const width = Math.max(...xs);
		const height = Math.max(...ys);
		const headStart = Math.max(...xs.filter((x) => x < width - 0.01));
		expect(
			width - headStart,
			'head depth is one short side, not half the width',
		).toBeLessThanOrEqual(height + 1);
	});

	/**
	 * The deck draws its elbows out of three separate straight connectors, each
	 * with one extent authored at zero. The SVG user space has to map uniformly
	 * onto device pixels or the line leans and its round `a:headEnd` markers
	 * smear into bars.
	 */
	test('a zero-extent connector maps its SVG uniformly', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.zeroExtentConnectors);

		const scales = await page.evaluate(() => {
			const out: Array<{ id: string; sx: number; sy: number }> = [];
			for (const host of document.querySelectorAll<HTMLElement>('[data-element-id]')) {
				const id = host.dataset.elementId ?? '';
				if (!id.includes('-conn-')) {
					continue;
				}
				const svg = host.querySelector('svg');
				const box = svg?.getBoundingClientRect();
				const view = svg?.getAttribute('viewBox')?.split(/\s+/u).map(Number);
				if (!svg || !box || !view || box.width === 0 || box.height === 0) {
					continue;
				}
				out.push({ id, sx: box.width / view[2], sy: box.height / view[3] });
			}
			return out;
		});

		expect(scales.length, 'found the slide’s connectors').toBeGreaterThan(0);
		for (const { id, sx, sy } of scales) {
			// Anisotropy is the defect: React stretched a 1-unit viewBox across a
			// 12px pad, scaling x by 12 while y stayed near 1.
			expect(sx / sy, `${id} is not stretched on one axis`).toBeCloseTo(1, 1);
		}
	});

	/**
	 * `<p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/>` is the only place
	 * slide 3's connector states its colour; `spPr/a:ln` holds nothing but
	 * `<a:headEnd type="oval"/>`. Dropping the style node stroked it in the
	 * default dark grey.
	 */
	test('a connector takes its colour from the style reference', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.linearGradients);

		const strokes = await page.evaluate(() => {
			const host = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find((node) =>
				(node.dataset.elementId ?? '').endsWith('slide3.xml-conn-0'),
			);
			if (!host) {
				return null;
			}
			// The COMPUTED stroke, not the attribute: one binding puts the colour on
			// the wrapper and strokes its `<line>` with `stroke="inherit"`.
			return [...host.querySelectorAll('path, line')]
				.map((node) => getComputedStyle(node).stroke)
				.filter((value) => value !== '' && value !== 'none' && !value.includes('0, 0, 0, 0'));
		});

		expect(strokes, 'found the themed connector').not.toBeNull();
		// accent1 of this deck's theme: #10A8AC.
		expect(strokes!.some((value) => value.replace(/\s/gu, '') === 'rgb(16,168,172)')).toBe(true);
	});

	/**
	 * `c:numFmt formatCode="0%"` on the value axis, and the same code on the
	 * series' value cache. The cached values are fractions (0.52), so without the
	 * format code the chart rendered `0.5` where PowerPoint renders `52%`.
	 */
	test('a percentage chart labels its axis and bars in percent', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.percentChart);

		const labels = await page.evaluate(() => {
			const host = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find((node) =>
				(node.dataset.elementId ?? '').endsWith('slide5.xml-frame-0'),
			);
			// Trimmed: bindings differ in the whitespace they leave around SVG text.
			return host
				? [...host.querySelectorAll('svg text')].map((node) => (node.textContent ?? '').trim())
				: null;
		});

		expect(labels, 'found the chart').not.toBeNull();
		expect(labels!.filter((text) => text.includes('%')).length).toBeGreaterThan(4);
		// The 52% bar's data label, and no raw fraction anywhere.
		expect(labels).toContain('52%');
		expect(labels!.some((text) => /^0\.\d+$/u.test(text.trim()))).toBe(false);
	});

	/**
	 * PowerPoint's automatic value axis rounds its bounds out to whole major
	 * units, so this chart reads `0% 20% 40% 60%` even though the tallest bar is
	 * 52%. Running the axis to the data maximum and dividing it into five gave
	 * `0% 10% 21% 31% 42% 52%` - every label a different arbitrary number.
	 */
	test('the value axis is labelled in round steps', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.percentChart);

		const axisLabels = await page.evaluate(() => {
			const host = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find((node) =>
				(node.dataset.elementId ?? '').endsWith('slide5.xml-frame-0'),
			);
			if (!host) {
				return null;
			}
			// Value-axis ticks are the percentage labels left of the plot; the data
			// labels sit above their bars. Take the leftmost column of them.
			// The tick labels are right-anchored against the axis, so they share a
			// right edge; the data labels are centred over their bars and each has
			// its own. Cluster on that edge and take the biggest column, then read
			// it bottom-to-top.
			const texts = [...host.querySelectorAll<SVGTextElement>('svg text')]
				.map((node) => {
					const box = node.getBoundingClientRect();
					return {
						text: (node.textContent ?? '').trim(),
						right: Math.round(box.right),
						y: box.top,
					};
				})
				.filter((entry) => entry.text.endsWith('%'));
			const columns = new Map<number, Array<{ text: string; y: number }>>();
			for (const entry of texts) {
				const column = columns.get(entry.right) ?? [];
				column.push({ text: entry.text, y: entry.y });
				columns.set(entry.right, column);
			}
			const axis = [...columns.values()].sort((a, b) => b.length - a.length)[0] ?? [];
			return axis.sort((a, b) => b.y - a.y).map((entry) => entry.text);
		});

		expect(axisLabels, 'found the chart').not.toBeNull();
		expect(axisLabels).toStrictEqual(['0%', '20%', '40%', '60%']);
	});

	/**
	 * Both `c:chartSpace/c:spPr` and `c:plotArea/c:spPr` declare `<a:noFill/>`,
	 * so the chart floats on the slide. Every binding painted a hardcoded wash
	 * across the whole chart instead, boxing it into a grey panel.
	 */
	test('a noFill chart paints no background panel', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.percentChart);

		const backgrounds = await page.evaluate(() => {
			const host = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find((node) =>
				(node.dataset.elementId ?? '').endsWith('slide5.xml-frame-0'),
			);
			const svg = host?.querySelector('svg');
			if (!svg) {
				return null;
			}
			const viewBox = svg.getAttribute('viewBox')?.split(/\s+/u).map(Number) ?? [0, 0, 0, 0];
			// Any rect covering the whole chart is a background panel.
			return [...svg.querySelectorAll('rect')].filter(
				(rect) =>
					Number(rect.getAttribute('width')) >= viewBox[2] &&
					Number(rect.getAttribute('height')) >= viewBox[3],
			).length;
		});

		expect(backgrounds, 'found the chart').not.toBeNull();
		expect(backgrounds).toBe(0);
	});

	/**
	 * The deck is set in `思源黑体 CN Light`, which is not installed. PowerPoint
	 * substitutes a sans; emitting the bare authored name left the browser to
	 * pick its own default, which for CJK is a SERIF.
	 */
	test('an uninstalled font still resolves to a generic family', async ({ page }) => {
		await loadDeck(page);
		await gotoSlide(page, SLIDE.uninstalledFont);

		const families = await page.evaluate(() => {
			const host = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find((node) =>
				(node.dataset.elementId ?? '').endsWith('slide12.xml-shape-1'),
			);
			if (!host) {
				return null;
			}
			return [host, ...host.querySelectorAll<HTMLElement>('*')]
				.map((node) => getComputedStyle(node).fontFamily)
				.filter((value) => value.includes('思源黑体'));
		});

		expect(families, 'found the text element').not.toBeNull();
		expect(families!.length).toBeGreaterThan(0);
		for (const family of families!) {
			// Every declaration naming the missing font must end in a generic.
			expect(family, 'declares a generic fallback').toMatch(/(sans-serif|serif|monospace)\s*$/u);
		}
	});
});
