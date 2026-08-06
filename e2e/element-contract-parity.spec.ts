/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Does every binding agree on what is on the slide?
 *
 * The five viewers advertise one shared contract for slide content: each
 * rendered element carries `data-pptx-element="true"`, the core-assigned
 * `data-element-id`, and the ARIA role / roledescription / label that
 * `packages/shared/src/render/accessibility.ts` computes for its type. Every
 * e2e spec in this directory is built on that contract, and so is anything
 * that enumerates, selects or hit-tests elements.
 *
 * A binding can drop part of it silently. Charts were found rendering
 * perfectly in Vue and Svelte while carrying no `data-pptx-element` marker at
 * all: the pixels were right, so nothing failed, but the chart was not an
 * element as far as the contract was concerned. That is invisible to a spec
 * that selects on the marker (it simply finds nothing and passes) and to any
 * spec that only looks at appearance.
 *
 * So this one walks the contract itself, across several decks and every slide
 * in them, and reports any element that a binding tags, names or classifies
 * differently from React.
 *
 * Run: bunx playwright test element-contract-parity
 */
import { expect, test } from '@playwright/test';

import { fixture, loadDeckAt, slideStage, thumbnail } from './support/deck';
import { acrossFrameworks, formatDiff, splitReference } from './support/parity';

test.use({ viewport: { width: 1440, height: 900 } });

/** Decks chosen to span the element-type union, and how many slides to walk. */
const DECKS = [
	{ name: 'sample-deck.pptx', slides: 7 },
	{ name: 'text-features.pptx', slides: 1 },
	{ name: 'ole-embed.pptx', slides: 1 },
	{ name: 'ink-annotation.pptx', slides: 1 },
	{ name: 'solution-explorer.pptx', slides: 2 },
] as const;

/** The contract as it appears on one rendered element. */
interface ElementContract {
	elementId: string;
	tagged: boolean;
	role: string;
	roleDescription: string;
	label: string;
}

/**
 * Read the contract off every element on the current slide.
 *
 * Elements are found by `data-element-id` rather than by the element marker,
 * because a missing marker is one of the defects being looked for and
 * selecting on it would hide exactly that case.
 */
async function readContract(page: import('@playwright/test').Page): Promise<ElementContract[]> {
	return page.evaluate(() => {
		const stage = document.querySelector('[aria-roledescription="slide"]');
		if (!stage) {
			return [];
		}
		return [...stage.querySelectorAll('[data-element-id]')].map((el) => ({
			elementId: el.getAttribute('data-element-id') ?? '',
			tagged: el.getAttribute('data-pptx-element') === 'true',
			role: el.getAttribute('role') ?? '',
			roleDescription: el.getAttribute('aria-roledescription') ?? '',
			label: (el.getAttribute('aria-label') ?? '').replace(/\s+/gu, ' ').trim().slice(0, 80),
		}));
	});
}

/** Every way a binding's contract disagrees with the reference's. */
function diffContract(
	reference: ElementContract[],
	candidate: ElementContract[],
	deck: string,
	slide: number,
): string[] {
	const problems: string[] = [];
	const where = `${deck} slide ${slide}`;
	const byId = new Map(candidate.map((element) => [element.elementId, element]));

	for (const expected of reference) {
		const actual = byId.get(expected.elementId);
		if (!actual) {
			problems.push(`${where}: element ${expected.elementId} is not rendered`);
			continue;
		}
		byId.delete(expected.elementId);

		// Both directions: a candidate that tags an element the reference leaves
		// untagged is just as much a contract divergence as the reverse, and the
		// one-directional check silently blessed whatever React happened to omit.
		if (expected.tagged !== actual.tagged) {
			const detail = expected.roleDescription || expected.role;
			problems.push(
				actual.tagged
					? `${where}: element ${expected.elementId} (${detail}) carries data-pptx-element="true", but the reference leaves it untagged`
					: `${where}: element ${expected.elementId} (${detail}) is missing data-pptx-element="true"`,
			);
		}
		for (const key of ['role', 'roleDescription', 'label'] as const) {
			if (expected[key] !== actual[key]) {
				problems.push(
					`${where}: element ${expected.elementId} ${key} is "${actual[key]}", reference has "${expected[key]}"`,
				);
			}
		}
	}

	for (const extra of byId.values()) {
		problems.push(
			`${where}: element ${extra.elementId} is rendered, but the reference has no such element`,
		);
	}

	return problems;
}

test.describe('cross-binding element contract', () => {
	for (const deck of DECKS) {
		test(`${deck.name}: every element is tagged and named identically`, async ({
			browser,
		}, testInfo) => {
			test.slow();

			const results = await acrossFrameworks(browser, testInfo, async (page, origin) => {
				await loadDeckAt(page, origin, fixture(deck.name));

				const perSlide: ElementContract[][] = [];
				for (let slide = 1; slide <= deck.slides; slide += 1) {
					if (slide > 1) {
						await thumbnail(page, slide).click();
						// Neutral navigation-done signal; a poll on contract counts alone
						// can capture the PREVIOUS slide's DOM in the slower bindings.
						await page
							.getByText(new RegExp(`\\b${slide} of \\d+\\b`, 'u'))
							.first()
							.waitFor({ timeout: 15_000 });
					}
					await slideStage(page).waitFor();
					// Angular and Svelte apply the accessibility attributes in a
					// microtask after the node mounts, so poll rather than read once.
					await expect
						.poll(async () => (await readContract(page)).length, { timeout: 15_000 })
						.toBeGreaterThan(0);
					perSlide.push(await readContract(page));
				}
				return perSlide;
			});

			const { reference, candidates } = splitReference(results);
			expect(reference.value.flat().length).toBeGreaterThan(0);

			const problems: string[] = [];
			for (const candidate of candidates) {
				const perBinding = reference.value.flatMap((referenceSlide, index) =>
					diffContract(referenceSlide, candidate.value[index] ?? [], deck.name, index + 1),
				);
				if (perBinding.length > 0) {
					problems.push(formatDiff(candidate.framework.name, perBinding));
				}
			}

			expect(problems.join('\n\n')).toBe('');
		});
	}
});
