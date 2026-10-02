/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright API */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { loadDeck, ribbonTab } from './support/deck';

/**
 * Home, Insert, Draw and Design against Microsoft PowerPoint's ribbon.
 *
 * One framework-neutral spec, run on every binding: it reads only `data-ribbon-group`,
 * `data-ribbon-control` and `data-pptx-chrome` hooks and measures geometry, so a binding that
 * drifts from Office's group order, large/small command structure or two-row layouts is named.
 * `docs/guide/ribbon-parity.md` holds the per-tab gap table and the PowerPoint reference captures.
 */
test.use({ viewport: { width: 1440, height: 900 } });

interface Probe {
	/** Group ids in document order, de-duplicated, with their visible captions. */
	groups: Array<{ id: string; caption: string; top: number; height: number }>;
	/** Geometry of the requested controls: host box, glyph box and whether a caption follows. */
	controls: Record<
		string,
		{
			w: number;
			h: number;
			x: number;
			y: number;
			iconW: number;
			iconY: number;
			iconX: number;
			text: string;
		} | null
	>;
}

async function probe(page: Page, groupPrefix: string, controls: string[]): Promise<Probe> {
	return page.evaluate(
		({ groupPrefix: prefix, controls: ids }) => {
			const visible = (el: Element) => {
				const r = el.getBoundingClientRect();
				return r.width > 0 && r.height > 0;
			};
			const seen = new Set<string>();
			const groups: Probe['groups'] = [];
			for (const el of document.querySelectorAll<HTMLElement>(`[data-ribbon-group^="${prefix}"]`)) {
				const id = el.dataset.ribbonGroup!;
				if (!visible(el) || seen.has(id)) {
					continue;
				}
				seen.add(id);
				const label =
					el.getAttribute('label') ??
					el.querySelector('[data-pptx-chrome="ribbon-group-label"]')?.textContent ??
					el.shadowRoot?.querySelector('.caption')?.textContent ??
					'';
				const r = el.getBoundingClientRect();
				groups.push({
					id,
					caption: label.trim(),
					top: Math.round(r.top),
					height: Math.round(r.height),
				});
			}
			const out: Probe['controls'] = {};
			for (const id of ids) {
				const host = [
					...document.querySelectorAll<HTMLElement>(`[data-ribbon-control="${id}"]`),
				].find(visible);
				if (!host) {
					out[id] = null;
					continue;
				}
				const button = host.matches('button')
					? host
					: ((host.shadowRoot ?? host).querySelector<HTMLElement>('button') ?? host);
				const svg = (button.shadowRoot ?? button).querySelector('svg');
				const rect = button.getBoundingClientRect();
				const icon = svg?.getBoundingClientRect();
				out[id] = {
					w: Math.round(rect.width),
					h: Math.round(rect.height),
					x: Math.round(rect.left),
					y: Math.round(rect.top),
					iconW: Math.round(icon?.width ?? 0),
					iconY: Math.round(icon?.top ?? 0),
					iconX: Math.round(icon?.left ?? 0),
					text: (button.innerText ?? '').trim(),
				};
			}
			return { groups, controls: out };
		},
		{ groupPrefix, controls },
	);
}

/** Office's large command: a 32px glyph over its caption, a 66px tile. */
function expectLarge(read: Probe['controls'][string], name: string, minHeight = 60): void {
	expect(read, `${name} is present`).not.toBeNull();
	expect(read!.iconW, `${name} glyph is 32px`).toBeGreaterThanOrEqual(28);
	expect(read!.h, `${name} is a 66px tile`).toBeGreaterThanOrEqual(minHeight);
	expect(read!.iconY - read!.y, `${name} glyph sits at the top`).toBeLessThanOrEqual(8);
}

/** Office's small command: a 16px glyph beside its caption in a 22-24px row. */
function expectSmall(read: Probe['controls'][string], name: string): void {
	expect(read, `${name} is present`).not.toBeNull();
	expect(read!.iconW, `${name} glyph is 16px`).toBeLessThanOrEqual(20);
	expect(read!.h, `${name} is a one-line row`).toBeLessThanOrEqual(30);
}

test.describe('Home', () => {
	// Wide enough for every group but the viewer's own Arrange extras, which collapse first.
	test.use({ viewport: { width: 1920, height: 1000 } });
	const HOME_GROUPS = [
		['home.clipboard', 'Clipboard'],
		['home.slides', 'Slides'],
		['home.font', 'Font'],
		['home.paragraph', 'Paragraph'],
		['home.drawing', 'Drawing'],
		['home.editing', 'Editing'],
		['home.arrange', 'Arrange'],
	];
	const IDS = [
		'home.clipboard.paste',
		'home.clipboard.cut',
		'home.clipboard.copy',
		'home.clipboard.formatPainter',
		'home.slides.newSlide',
		'home.slides.layout',
		'home.slides.reset',
		'home.slides.section',
		'home.font.fontFamily',
		'home.font.fontSize',
		'home.font.increaseFontSize',
		'home.font.bold',
		'home.font.italic',
		'home.font.fontColor',
		'home.paragraph.bullets',
		'home.paragraph.decreaseIndent',
		'home.paragraph.alignLeft',
		'home.paragraph.justify',
		'home.editing.find',
		'home.editing.replace',
		'home.drawing.shapes',
		'home.drawing.arrange',
		'home.drawing.shapeFill',
		'home.drawing.shapeOutline',
	];

	test('groups follow Office order with one caption each and a shared height', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Home').click();
		const { groups } = await probe(page, 'home.', []);
		expect(groups.map((group) => group.id)).toStrictEqual(HOME_GROUPS.map(([id]) => id));
		expect(groups.map((group) => group.caption)).toStrictEqual(
			HOME_GROUPS.map(([, caption]) => caption),
		);
		// Every group stretches the whole ribbon, so the hairlines between them are one height.
		expect(new Set(groups.map((group) => group.top)).size).toBe(1);
		expect(new Set(groups.map((group) => group.height)).size).toBe(1);
		// Font is a single group (family and size share it), not two captions.
		await expect(page.locator('[data-ribbon-group="home.font"]')).toHaveCount(1);
	});

	test('large and small commands match PowerPoint', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Home').click();
		const { controls } = await probe(page, 'home.', IDS);
		// New Slide is a split: its 52px glyph-and-caption half sits over a 14px menu strip.
		expectLarge(controls['home.slides.newSlide'], 'home.slides.newSlide', 50);
		for (const id of [
			'home.clipboard.paste',
			'home.slides.layout',
			'home.slides.reset',
			'home.slides.section',
			'home.drawing.shapes',
			'home.drawing.arrange',
		]) {
			expectLarge(controls[id], id);
		}
		for (const id of [
			'home.clipboard.cut',
			'home.clipboard.copy',
			'home.clipboard.formatPainter',
			'home.editing.find',
			'home.editing.replace',
			'home.drawing.shapeFill',
			'home.drawing.shapeOutline',
		]) {
			expectSmall(controls[id], id);
			// Labelled rows: the caption is visible text, not only a tooltip.
			expect(controls[id]!.text.length, `${id} shows a caption`).toBeGreaterThan(2);
		}
		// Cut, Copy and Format Painter, like Find and Replace, are a column of rows.
		const clip = ['cut', 'copy', 'formatPainter'].map((n) => controls[`home.clipboard.${n}`]!);
		expect(clip[0].x).toBe(clip[1].x);
		expect(clip[1].y).toBeGreaterThan(clip[0].y);
		expect(clip[2].y).toBeGreaterThan(clip[1].y);
		// ...and sit to the right of the large Paste, over the same height.
		expect(clip[0].x).toBeGreaterThan(controls['home.clipboard.paste']!.x);
	});

	test('Font and Paragraph are two rows with Office placement', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Home').click();
		const { controls } = await probe(page, 'home.', IDS);
		const at = (id: string) => controls[id]!;
		// Row one: family, size and Grow beside it; row two: Bold and Italic.
		expect(Math.abs(at('home.font.fontFamily').y - at('home.font.fontSize').y)).toBeLessThanOrEqual(
			3,
		);
		expect(
			Math.abs(at('home.font.fontSize').y - at('home.font.increaseFontSize').y),
		).toBeLessThanOrEqual(3);
		expect(at('home.font.bold').y).toBeGreaterThan(at('home.font.fontFamily').y + 20);
		expect(Math.abs(at('home.font.bold').y - at('home.font.italic').y)).toBeLessThanOrEqual(3);
		expect(Math.abs(at('home.font.bold').y - at('home.font.fontColor').y)).toBeLessThanOrEqual(6);
		expect(at('home.font.bold').x).toBeLessThanOrEqual(at('home.font.fontFamily').x + 2);
		// Paragraph: lists and indents above, alignment below.
		expect(at('home.paragraph.alignLeft').y).toBeGreaterThan(at('home.paragraph.bullets').y + 20);
		expect(
			Math.abs(at('home.paragraph.bullets').y - at('home.paragraph.decreaseIndent').y),
		).toBeLessThanOrEqual(3);
		expect(at('home.paragraph.justify').x).toBeGreaterThan(at('home.paragraph.alignLeft').x);
	});

	test('captions use the 11px ribbon label size', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Home').click();
		const sizes = await page.evaluate(() =>
			[
				...document.querySelectorAll(
					'[data-ribbon-group^="home."] [data-pptx-chrome="ribbon-group-label"]',
				),
			]
				.filter((el) => el.getBoundingClientRect().width > 0)
				.map((el) => getComputedStyle(el).fontSize),
		);
		expect(sizes.length).toBeGreaterThanOrEqual(6);
		expect(new Set(sizes)).toStrictEqual(new Set(['11px']));
	});
});

test.describe('Insert', () => {
	const GROUPS = [
		['insert.tables', 'Tables'],
		['insert.images', 'Images'],
		['insert.illustrations', 'Illustrations'],
		['insert.links', 'Links'],
		['insert.text', 'Text'],
		['insert.symbols', 'Symbols'],
		['insert.media', 'Media'],
	];
	const LARGE = [
		'insert.tables.table',
		'insert.images.pictures',
		'insert.illustrations.shapes',
		'insert.illustrations.smartArt',
		'insert.illustrations.chart',
		'insert.links.link',
		'insert.links.action',
		'insert.text.textBox',
		'insert.text.field',
		'insert.symbols.equation',
		'insert.media.media',
	];

	test('groups follow Office order and every command is a large tile', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Insert').click();
		const { groups, controls } = await probe(page, 'insert.', LARGE);
		expect(groups.map((group) => group.id)).toStrictEqual(GROUPS.map(([id]) => id));
		expect(groups.map((group) => group.caption)).toStrictEqual(
			GROUPS.map(([, caption]) => caption),
		);
		expect(new Set(groups.map((group) => group.height)).size).toBe(1);
		for (const id of LARGE) {
			expectLarge(controls[id], id);
		}
		// Left to right: Table, Images, Illustrations, Links, Text, Symbols, Media.
		const xs = LARGE.map((id) => controls[id]!.x);
		expect(xs).toStrictEqual([...xs].sort((a, b) => a - b));
	});

	test('Shapes and Chart open a gallery under a chevron, as Office does', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Insert').click();
		const shapes = page.locator('[data-ribbon-control="insert.illustrations.shapes"] .trigger');
		await expect(shapes).toHaveAttribute('aria-haspopup', 'menu');
		await shapes.click();
		const first = page.locator(
			'[data-ribbon-control="insert.illustrations.shapes"] .list.grid button',
		);
		expect(await first.count()).toBeGreaterThan(12);
		// A grid of 32px glyph tiles, not a list of captions.
		const box = await first.first().boundingBox();
		expect(box!.width).toBeLessThanOrEqual(34);
	});
});

test.describe('Draw', () => {
	test('drawing tools are tall pen tiles beside a colour swatch and width control', async ({
		page,
	}) => {
		await loadDeck(page);
		await ribbonTab(page, 'Draw').click();
		const { groups, controls } = await probe(page, 'draw.', [
			'draw.tools.select',
			'draw.tools.pen',
			'draw.tools.highlighter',
			'draw.tools.eraser',
			'draw.tools.penColor',
			'draw.tools.penWidth',
		]);
		expect(groups.map((group) => group.id)).toStrictEqual(['draw.tools']);
		for (const id of ['select', 'pen', 'highlighter', 'eraser']) {
			const tool = controls[`draw.tools.${id}`];
			expect(tool, `${id} tool`).not.toBeNull();
			expect(tool!.h, `${id} is a tall tile`).toBeGreaterThanOrEqual(56);
			expect(tool!.text, `${id} is icon-only`).toBe('');
		}
		// The swatch and width control sit to the right of the tools.
		expect(controls['draw.tools.penColor']!.x).toBeGreaterThan(controls['draw.tools.eraser']!.x);
		expect(controls['draw.tools.penWidth']!.x).toBeGreaterThan(controls['draw.tools.eraser']!.x);
	});
});

test.describe('Design', () => {
	test('Themes, Variants and Customize: large commands and stacked variants', async ({ page }) => {
		await loadDeck(page);
		await ribbonTab(page, 'Design').click();
		const { groups, controls } = await probe(page, 'design.', [
			'design.themes.browseThemes',
			'design.themes.editTheme',
			'design.variants.colors',
			'design.variants.fonts',
			'design.customize.slideSize',
			'design.customize.formatBackground',
		]);
		expect(groups.map((group) => group.id)).toStrictEqual([
			'design.themes',
			'design.variants',
			'design.customize',
		]);
		expect(groups.map((group) => group.caption)).toStrictEqual(['Themes', 'Variants', 'Customize']);
		for (const id of [
			'design.themes.browseThemes',
			'design.themes.editTheme',
			'design.customize.slideSize',
			'design.customize.formatBackground',
		]) {
			expectLarge(controls[id], id);
		}
		// Variants: Colors above Fonts, like the Variants menu entries.
		const colors = controls['design.variants.colors']!;
		const fonts = controls['design.variants.fonts']!;
		expect(colors).not.toBeNull();
		expect(fonts.y).toBeGreaterThan(colors.y);
		expect(Math.abs(fonts.x - colors.x)).toBeLessThanOrEqual(4);
	});
});
