/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Entrance effects play PowerPoint's own behaviour tree, against
 * `animation-behavior-playback.pptx` (`scripts/make-animation-behavior-fixture.ps1`,
 * genuine PowerPoint output). Run identically against every framework demo.
 *
 * Slide 1 is a Fly In from the left on a 100 pt square at x = 700 pt.
 * PowerPoint (CreateVideo, 62.5 fps) starts it with its right edge on the
 * slide's left edge and moves it at constant speed, so it travels x + w =
 * 800 pt, eight of its own widths, fully opaque the whole way. The old preset
 * keyframe moved it one width and faded it in.
 *
 * Every measurement is a ratio of the element's own on-screen width, so the
 * stage scale of each binding cancels out. The DOM contract is framework
 * neutral: `[data-element-id]`, the Present button, the Web Animations API.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { fixture, loadDeck } from './support/deck';

const DECK = fixture('animation-behavior-playback.pptx');

async function startShow(page: Page): Promise<void> {
	await page
		.getByRole('button', { name: /^present$|slide show/iu })
		.first()
		.click();
	await page.waitForTimeout(600);
}

interface FlySample {
	name: string;
	/** Offset from the resting position, in element widths, at each fraction. */
	offsets: number[];
	opacities: number[];
}

/**
 * Pause the element playing a behaviour-tree keyframe and read its position
 * at each fraction of the effect, in one synchronous pass (the playback
 * engine clears a finished entrance's animation shortly after it ends).
 */
function sampleFly(page: Page, fractions: readonly number[]): Promise<FlySample | undefined> {
	return page.evaluate((at) => {
		const el = [...document.querySelectorAll<HTMLElement>('[data-element-id]')].find((node) =>
			node.style.animationName?.startsWith('pptx-tl-bhvr'),
		);
		const animation = el
			?.getAnimations()
			.find((a) => (a as CSSAnimation).animationName?.startsWith('pptx-tl-bhvr'));
		if (!el || !animation) {
			return undefined;
		}
		animation.pause();
		const timing = animation.effect!.getComputedTiming();
		const delay = Number(timing.delay ?? 0);
		const duration = Number(timing.duration ?? 0);
		const seek = (f: number) => {
			animation.currentTime = delay + duration * f;
			return el.getBoundingClientRect();
		};
		const rest = seek(1);
		const offsets: number[] = [];
		const opacities: number[] = [];
		for (const f of at) {
			offsets.push((seek(f).left - rest.left) / rest.width);
			opacities.push(Number(getComputedStyle(el).opacity));
		}
		return { name: (animation as CSSAnimation).animationName, offsets, opacities };
	}, fractions);
}

test.describe('entrance effects play the deck behaviour tree', () => {
	test('Fly In starts just off the slide edge, a distance set by its position', async ({
		page,
	}) => {
		await loadDeck(page, DECK);
		await startShow(page);
		await page.keyboard.press('ArrowRight');
		// Sample in the same poll that finds the running effect: the engine
		// clears a finished entrance's animation about a second later.
		let sample: FlySample | undefined;
		await expect
			.poll(
				async () => {
					sample = await sampleFly(page, [0.25, 0.5, 0.75]);
					return sample;
				},
				{ timeout: 8000, intervals: [50] },
			)
			.toBeDefined();
		if (!sample) {
			throw new Error('no behaviour-tree animation ran');
		}
		expect(sample.name).toMatch(/^pptx-tl-bhvr-/u);
		// A linear 800 pt trip in 100 pt widths: 6, 4 and 2 widths left of rest.
		expect(sample.offsets[0]).toBeCloseTo(-6, 1);
		expect(sample.offsets[1]).toBeCloseTo(-4, 1);
		expect(sample.offsets[2]).toBeCloseTo(-2, 1);
		// Fly never fades.
		expect(sample.opacities).toStrictEqual([1, 1, 1]);
	});
});
