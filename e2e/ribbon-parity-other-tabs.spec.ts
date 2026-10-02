/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
/**
 * Ribbon parity with Microsoft PowerPoint for Transitions, Animations, Slide Show,
 * Record, Review, View and the contextual tabs. Each binding must show the same
 * groups in the same order and draw each command large (icon above label) or
 * small (icon beside label) the way PowerPoint does. See
 * `docs/guide/ribbon-parity-other-tabs.md` for the gap tables.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
	elementsOfType,
	elementWithText,
	fixture,
	loadDeck,
	ribbon,
	ribbonTab,
	selectElement,
} from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

interface GroupReading {
	id: string;
	label: string;
	box: { y: number; height: number };
	/** Control id (or accessible text) to `large` / `small`. */
	commands: Record<string, 'large' | 'small'>;
}

/** The groups the active tab shows, in DOM order, with the shape of their commands. */
async function readGroups(page: Page): Promise<GroupReading[]> {
	return ribbon(page)
		.locator('pptx-ui-ribbon-group:visible')
		.evaluateAll((groups) =>
			groups.map((group) => {
				const rect = group.getBoundingClientRect();
				const commands: Record<string, 'large' | 'small'> = {};
				for (const command of group.querySelectorAll('pptx-ui-ribbon-command')) {
					const key =
						command.getAttribute('data-ribbon-control') ?? command.getAttribute('label') ?? '';
					commands[key] = command.hasAttribute('compact') ? 'small' : 'large';
				}
				return {
					id: group.getAttribute('data-ribbon-group') ?? '',
					label: group.getAttribute('label') ?? '',
					box: { y: rect.y, height: rect.height },
					commands,
				};
			}),
		);
}

async function openTab(page: Page, name: string): Promise<GroupReading[]> {
	await ribbonTab(page, name).click();
	await page.waitForTimeout(200);
	return readGroups(page);
}

const labels = (groups: GroupReading[]) => groups.map((group) => group.label);

test.describe('fixed tabs match the PowerPoint ribbon structure', () => {
	test.beforeEach(async ({ page }) => {
		await loadDeck(page);
	});

	test('Transitions: Preview, Transition to This Slide (icon tiles + Effect Options), Timing', async ({
		page,
	}) => {
		const groups = await openTab(page, 'Transitions');
		expect(labels(groups)).toEqual(['Preview', 'Transition to This Slide', 'Timing']);
		expect(groups[0].commands['transitions.preview.preview']).toBe('large');
		expect(groups[2].commands['transitions.timing.applyToAll']).toBe('small');
		// Effect Options is a large command with a drop-down chevron inside the gallery group.
		const effectOptions = ribbon(page).locator('pptx-ui-ribbon-command.inspector');
		await expect(effectOptions).toHaveAttribute('label', 'Effect Options');
		await expect(effectOptions).not.toHaveAttribute('compact', '');
		// Every transition is an icon-over-label tile, not a text pill.
		const tiles = ribbon(page).locator(
			'[data-ribbon-control="transitions.transitionToThisSlide.gallery"] .preset',
		);
		expect(await tiles.count()).toBeGreaterThanOrEqual(9);
		await expect(tiles.first().locator('svg.tile-icon')).toHaveCount(1);
		const tile = await tiles.first().boundingBox();
		expect(tile!.height).toBeGreaterThan(tile!.width * 0.8);
		// Sound, Duration and Apply To All stack in one column with the Advance Slide fields beside it.
		const timing = ribbon(page).locator('[data-ribbon-group="transitions.timing"]');
		await expect(timing.getByText('Advance Slide', { exact: true })).toBeVisible();
		await expect(timing.getByRole('checkbox', { name: 'On Mouse Click' })).toBeVisible();
	});

	test('Animations: gallery tiles, Effect Options beside the gallery, three-row advanced stack', async ({
		page,
	}) => {
		const groups = await openTab(page, 'Animations');
		expect(labels(groups)).toEqual([
			'Preview',
			'Animation',
			'Motion Paths',
			'Advanced Animation',
			'Timing',
		]);
		expect(groups[0].commands['animations.preview.preview']).toBe('large');
		expect(groups[1].commands['animations.animation.effectOptions']).toBe('large');
		expect(groups[3].commands['animations.advancedAnimation.addAnimation']).toBe('large');
		expect(groups[3].commands['animations.advancedAnimation.animationPane']).toBe('small');
		expect(groups[3].commands['animations.advancedAnimation.trigger']).toBe('small');
		expect(groups[3].commands['animations.advancedAnimation.animationPainter']).toBe('small');
		const flyIn = ribbon(page).locator('[data-animation-preset="flyIn"]');
		await expect(flyIn.locator('svg.tile-icon')).toHaveCount(1);
		const box = await flyIn.boundingBox();
		expect(box!.height).toBeGreaterThan(box!.width * 0.8);
	});

	test('Slide Show: Custom Slide Show joins Start Slide Show; every launcher is large', async ({
		page,
	}) => {
		const groups = await openTab(page, 'Slide Show');
		expect(labels(groups)).toEqual(['Start Slide Show', 'Present', 'Set Up', 'Options']);
		expect(Object.keys(groups[0].commands)).toEqual([
			'slideShow.startSlideShow.fromBeginning',
			'slideShow.startSlideShow.fromCurrent',
			'slideShow.startSlideShow.customShow',
		]);
		for (const kind of Object.values(groups[0].commands)) {
			expect(kind).toBe('large');
		}
		await expect(ribbon(page).getByRole('checkbox', { name: 'Use Timings' })).toBeVisible();
		await expect(ribbon(page).getByRole('checkbox', { name: 'Play Narrations' })).toBeVisible();
	});

	test('Record: Cameo, Record, Edit and Help groups, all large commands', async ({ page }) => {
		const groups = await openTab(page, 'Record');
		expect(labels(groups)).toEqual(['Cameo', 'Record', 'Edit', 'Help']);
		for (const group of groups) {
			for (const kind of Object.values(group.commands)) {
				expect(kind).toBe('large');
			}
		}
	});

	test('Review: Proofing to Ink, with New Comment, Delete, Previous, Next, Show Comments large', async ({
		page,
	}) => {
		const groups = await openTab(page, 'Review');
		expect(labels(groups)).toEqual([
			'Proofing',
			'Accessibility',
			'Language',
			'Changes',
			'Comments',
			'Protect',
			'Ink',
		]);
		const comments = groups[4];
		expect(Object.keys(comments.commands)).toEqual([
			'review.comments.newComment',
			'review.comments.delete',
			'review.comments.previous',
			'review.comments.next',
			'review.comments.showComments',
		]);
		for (const kind of Object.values(comments.commands)) {
			expect(kind).toBe('large');
		}
		await expect(ribbon(page).getByRole('button', { name: 'New Comment' })).toBeVisible();
		// Commands that open a menu carry PowerPoint's drop-down chevron.
		await expect(
			ribbon(page).locator('[data-ribbon-control="review.accessibility.check"] svg.caret'),
		).toBeVisible();
	});

	test('View: five groups, Show is three columns of three rows', async ({ page }) => {
		const groups = await openTab(page, 'View');
		expect(labels(groups)).toEqual([
			'Presentation Views',
			'Master Views',
			'Show',
			'Zoom',
			'Window',
		]);
		const show = ribbon(page).locator('[data-ribbon-group="view.show"]');
		const columns = await show
			.locator('pptx-ui-ribbon-toggle, pptx-ui-ribbon-command')
			.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().x));
		// Cluster x positions (toggles and buttons differ by a few px of padding).
		const clusters = [...columns]
			.sort((a, b) => a - b)
			.reduce<number[]>((acc, x) => {
				if (acc.length === 0 || x - acc[acc.length - 1] > 16) {
					acc.push(x);
				}
				return acc;
			}, []);
		expect(clusters.length).toBeLessThanOrEqual(3);
		// The tab is no taller than the Transitions tab (it was twice as tall with a six-row stack).
		const view = groups[2].box.height;
		await ribbonTab(page, 'Transitions').click();
		const transitions = (await readGroups(page))[1].box.height;
		expect(view).toBeLessThanOrEqual(transitions + 8);
	});
});

const CONTEXTUAL: {
	label: string;
	fixture: string;
	tab: string;
	groups: string[];
	pick: (page: Page) => ReturnType<typeof elementsOfType>;
}[] = [
	{
		label: 'Shape Format',
		fixture: 'ribbon-galleries.pptx',
		tab: 'shapeFormat',
		groups: ['Shape Styles', 'WordArt Styles'],
		pick: (page) => elementWithText(page, 'GALLERY SHAPE'),
	},
	{
		label: 'Picture Format',
		fixture: 'ribbon-galleries.pptx',
		tab: 'pictureFormat',
		groups: ['Adjust', 'Picture Styles'],
		pick: (page) => elementsOfType(page, 'image').first(),
	},
	{
		label: 'Table Design',
		fixture: 'ribbon-galleries.pptx',
		tab: 'tableDesign',
		groups: ['Table Styles'],
		pick: (page) => elementWithText(page, '2B'),
	},
	{
		label: 'Chart Design',
		fixture: 'ribbon-galleries.pptx',
		tab: 'chartDesign',
		groups: ['Chart Layouts', 'Chart Styles'],
		pick: (page) => elementsOfType(page, 'chart').first(),
	},
	{
		label: 'SmartArt Design',
		fixture: 'smartart-build-reveal.pptx',
		tab: 'smartArtDesign',
		groups: ['Create Graphic', 'Layouts', 'SmartArt Styles', 'Reset'],
		pick: (page) => elementWithText(page, 'Alpha'),
	},
];

for (const entry of CONTEXTUAL) {
	test(`${entry.label} appears for its object with the expected groups`, async ({ page }) => {
		await loadDeck(page, fixture(entry.fixture));
		await expect(page.locator(`[data-ribbon-contextual-tab="${entry.tab}"]`)).toHaveCount(0);
		await selectElement(page, entry.pick(page));
		const tab = page.locator(`[data-ribbon-contextual-tab="${entry.tab}"]`).first();
		await expect(tab).toBeVisible();
		await expect(tab).toContainText(entry.label);
		await tab.click();
		await page.waitForTimeout(200);
		expect(labels(await readGroups(page))).toEqual(entry.groups);
	});
}

test('Picture Format stacks Corrections, Color and Artistic Effects in one column', async ({
	page,
}) => {
	await loadDeck(page, fixture('ribbon-galleries.pptx'));
	await selectElement(page, elementsOfType(page, 'image').first());
	await page.locator('[data-ribbon-contextual-tab="pictureFormat"]').first().click();
	const triggers = ribbon(page).locator(
		'[data-ribbon-group="pictureFormat.adjust"] pptx-ui-ribbon-gallery',
	);
	expect(await triggers.count()).toBe(3);
	const boxes = await triggers.evaluateAll((items) =>
		items.map((item) => {
			const rect = item.getBoundingClientRect();
			return { x: Math.round(rect.x), y: Math.round(rect.y) };
		}),
	);
	expect(new Set(boxes.map((box) => box.x)).size).toBe(1);
	expect(new Set(boxes.map((box) => box.y)).size).toBe(3);
});

test('SmartArt Design offers Create Graphic, Layouts and Reset with working Add Shape', async ({
	page,
}) => {
	await loadDeck(page, fixture('smartart-build-reveal.pptx'));
	await selectElement(page, elementWithText(page, 'Alpha'));
	await page.locator('[data-ribbon-contextual-tab="smartArtDesign"]').first().click();
	const bar = ribbon(page);
	// Three rows by three columns of small commands, like PowerPoint's Create Graphic.
	const create = bar.locator(
		'[data-ribbon-group="smartArtDesign.createGraphic"] pptx-ui-ribbon-gallery',
	);
	expect(await create.count()).toBe(8);
	const ys = await create.evaluateAll((items) =>
		items.map((item) => Math.round(item.getBoundingClientRect().y)),
	);
	expect(new Set(ys).size).toBe(3);
	// Layouts is a gallery strip with a drop-down of every switchable family.
	const layouts = bar.locator('[data-ribbon-control="smartArtDesign.layouts.gallery"]');
	await expect(layouts.locator('[data-gallery-item]').first()).toBeVisible();
	// Commands that need a selected node are present but disabled, and say why.
	const promote = bar.locator(
		'[data-ribbon-control="smartArtDesign.createGraphic.promote"] button',
	);
	await expect(promote).toBeDisabled();
	await expect(promote).toHaveAttribute('title', /text pane/iu);
	// Reset Graphic is a large command.
	const reset = bar.locator('[data-ribbon-control="smartArtDesign.reset.resetGraphic"]');
	await expect(reset).toHaveAttribute('data-command-large', '');
	// Add Shape runs the core node edit through the normal history path.
	const undo = page.getByRole('button', { name: 'Undo', exact: true }).first();
	await expect(undo).toBeDisabled();
	await bar.locator('[data-ribbon-control="smartArtDesign.createGraphic.addShape"] button').click();
	await expect(undo).toBeEnabled();
});
