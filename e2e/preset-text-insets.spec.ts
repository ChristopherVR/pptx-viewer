/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Preset text-inset rectangles: does a shape whose ECMA-376 `<a:rect>` pulls
 * text away from the bounding box actually push its glyphs in further than a
 * plain `rect` (which has no such override), on the specific edges that
 * shape's own `<a:rect>` actually moves?
 *
 * `packages/core/src/core/geometry/preset-text-rect-*.ts` (and the older
 * hand-derived `preset-text-rect-table.ts`) compute the per-preset inset. Not
 * every edge moves for every shape - this spec was written by first assuming
 * "left AND top" for all six, and that assumption was WRONG for two of them
 * (verified by reading the actual guide tables after this spec's first run
 * failed identically on all five bindings, including the React reference,
 * which is the signature of a bad assumption rather than a real defect):
 *
 *  - `chevron` has NO entry in the ECMA override tables at all (falls back to
 *    the older hand-derived table), which insets LEFT and RIGHT only; top/
 *    bottom equal the plain box edges.
 *  - `homePlate`'s ECMA rect is `{ l: 'l', t: 't', r: 'ir', b: 'b' }` - `l`,
 *    `t`, `b` are literally the box's own edges; only `r` (`ir`) is pulled in.
 *
 * `star5`, `pie` and `flowChartDecision` genuinely inset all four edges
 * (their guide tables resolve `l`/`t`/`r`/`b` to inscribed points, not the box
 * edges verbatim), so those three are checked on every axis.
 *
 * `actionButtonHome` is the one shape ECMA-376 itself gives a
 * `<a:rect l="l" t="t" r="r" b="b"/>` - the full bounding box, byte-identical
 * to a plain rect's implicit text area - so it is checked for "not less than"
 * the control rather than "strictly greater". See
 * `generate-preset-text-insets-fixture.ts`'s header for the source note.
 *
 * Measurements are FRACTIONS of the element's own box (not absolute CSS px):
 * the five bindings each pick their own fit-to-window zoom independently, so
 * an absolute-px comparison across bindings measures zoom-level noise, not
 * layout - a first version of this spec that compared raw px reported a ~7x
 * mismatch on every shape between two bindings that was purely that scale
 * difference, not a real inset bug.
 *
 * Fixture: `preset-text-insets.pptx` (one `rect` control + six presets, each
 * holding the same long, left-aligned, top-anchored, wrapped body text).
 *
 * Run: bunx playwright test preset-text-insets
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { INSET_SHAPES } from './fixtures/generate-preset-text-insets-fixture';
import { fixture, loadDeckAt, slideStage } from './support/deck';
import { acrossFrameworks, splitReference } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

const FIXTURE = fixture('preset-text-insets.pptx');

/** Glyph-box offsets from the element's own box, as a FRACTION of its width/height. */
interface InsetFacts {
	/** (leftmost glyph x - box left) / box width. */
	leftFrac: number;
	/** (topmost glyph y - box top) / box height. */
	topFrac: number;
	/** (box right - rightmost glyph x) / box width. */
	rightFrac: number;
}

/** Measure the glyph-box inset of the element whose text contains `marker`. */
async function measureInset(page: Page, marker: string): Promise<InsetFacts> {
	return page.evaluate((text) => {
		const root = [...document.querySelectorAll('[data-element-id]')].find((el) =>
			(el.textContent ?? '').includes(text),
		);
		if (!root) {
			throw new Error(`no rendered element contains ${JSON.stringify(text)}`);
		}
		const box = root.getBoundingClientRect();
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let left = Number.POSITIVE_INFINITY;
		let top = Number.POSITIVE_INFINITY;
		let right = Number.NEGATIVE_INFINITY;
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (!(node.textContent ?? '').trim()) {
				continue;
			}
			const range = document.createRange();
			range.selectNodeContents(node);
			for (const rect of range.getClientRects()) {
				if (rect.width === 0 && rect.height === 0) {
					continue;
				}
				left = Math.min(left, rect.left);
				top = Math.min(top, rect.top);
				right = Math.max(right, rect.right);
			}
		}
		const measured = Number.isFinite(left) && box.width > 0 && box.height > 0;
		return {
			leftFrac: measured ? (left - box.left) / box.width : -1,
			topFrac: measured ? (top - box.top) / box.height : -1,
			rightFrac: measured ? (box.right - right) / box.width : -1,
		};
	}, marker);
}

type ShapeKey = keyof typeof INSET_SHAPES;
type Axis = 'leftFrac' | 'topFrac' | 'rightFrac';

async function readSlide(page: Page, origin: string): Promise<Record<ShapeKey, InsetFacts>> {
	await loadDeckAt(page, origin, FIXTURE);
	await slideStage(page).waitFor();
	await page.waitForFunction(() => document.fonts.status === 'loaded');
	await page.waitForTimeout(500);
	const entries = await Promise.all(
		(Object.keys(INSET_SHAPES) as ShapeKey[]).map(
			async (key) => [key, await measureInset(page, INSET_SHAPES[key])] as const,
		),
	);
	return Object.fromEntries(entries) as Record<ShapeKey, InsetFacts>;
}

/** Which axes each preset's ECMA rect actually moves relative to a plain rect. */
const STRICTLY_GREATER_AXES: Partial<Record<ShapeKey, readonly Axis[]>> = {
	chevron: ['leftFrac', 'rightFrac'],
	homePlate: ['rightFrac'],
	star5: ['leftFrac', 'topFrac', 'rightFrac'],
	pie: ['leftFrac', 'topFrac', 'rightFrac'],
	flowChartDecision: ['leftFrac', 'topFrac', 'rightFrac'],
};

/**
 * Presets only expected to inset AT LEAST as much (ECMA's rect is the full
 * box). `rightFrac` is deliberately excluded here: for left-aligned wrapped
 * text it is a WRAP-BOUNDARY measurement (where the last word before a line
 * break happened to land), which is inherently noisy depending on word-break
 * granularity - not a reliable signal for "must equal the control", even
 * though it works fine as a "must be strictly greater" signal where the true
 * difference is large (see `STRICTLY_GREATER_AXES`).
 */
const NOT_LESS_AXES: Partial<Record<ShapeKey, readonly Axis[]>> = {
	actionButtonHome: ['leftFrac', 'topFrac'],
};

/** Fractional slack for anti-aliasing/wrap-boundary noise (as a fraction of box size). */
const EPSILON = 0.01;

/** Cross-binding equality tolerance, looser than `EPSILON` (font-rendering noise). */
const CROSS_BINDING_TOLERANCE = 0.03;

const AXIS_LABEL: Record<Axis, string> = {
	leftFrac: 'left',
	topFrac: 'top',
	rightFrac: 'right',
};

function pct(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

test.describe('preset text-inset rectangles', () => {
	test('each preset insets its text further than a plain rect on its own affected edges, identically across bindings', async ({
		browser,
	}, testInfo) => {
		test.slow();
		const results = await acrossFrameworks(browser, testInfo, readSlide);

		const failures = results.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			const control = value.rect;

			for (const [key, axes] of Object.entries(STRICTLY_GREATER_AXES) as [
				ShapeKey,
				readonly Axis[],
			][]) {
				const facts = value[key];
				for (const axis of axes) {
					if (facts[axis] <= control[axis] + EPSILON) {
						problems.push(
							`${key}: ${AXIS_LABEL[axis]} inset ${pct(facts[axis])} is not greater than the rect control's ${pct(control[axis])}`,
						);
					}
				}
			}
			for (const [key, axes] of Object.entries(NOT_LESS_AXES) as [ShapeKey, readonly Axis[]][]) {
				const facts = value[key];
				for (const axis of axes) {
					if (facts[axis] < control[axis] - EPSILON) {
						problems.push(
							`${key}: ${AXIS_LABEL[axis]} inset ${pct(facts[axis])} is LESS than the rect control's ${pct(control[axis])}`,
						);
					}
				}
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(failures.join('\n')).toBe('');

		// Cross-framework equality: every binding must resolve the same inset,
		// not merely "some positive inset", on the axes each preset actually moves.
		const { reference, candidates } = splitReference(results);
		const crossBindingFailures = candidates.flatMap(({ framework, value }) => {
			const problems: string[] = [];
			for (const key of Object.keys(INSET_SHAPES) as ShapeKey[]) {
				const axes = STRICTLY_GREATER_AXES[key] ?? NOT_LESS_AXES[key] ?? [];
				for (const axis of axes) {
					const a = reference.value[key][axis];
					const b = value[key][axis];
					if (Math.abs(a - b) > CROSS_BINDING_TOLERANCE) {
						problems.push(
							`${key}: ${AXIS_LABEL[axis]} inset ${pct(b)} vs ${reference.framework.name}'s ${pct(a)}`,
						);
					}
				}
			}
			return problems.length > 0 ? [`${framework.name}: ${problems.join('; ')}`] : [];
		});

		expect(crossBindingFailures.join('\n')).toBe('');
	});
});
