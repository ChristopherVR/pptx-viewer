/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec */
import { expect, test } from '@playwright/test';

import { elementWithText, loadDeck, selectElement } from './support/deck';

test.use({ viewport: { width: 1440, height: 900 } });

test('the editor keeps its desktop chrome proportions across bindings', async ({ page }) => {
	await loadDeck(page);
	const paint = await page.evaluate(() => {
		const box = (role: string) => {
			const el = document.querySelector(`[data-pptx-chrome="${role}"]`)!;
			const rect = el.getBoundingClientRect();
			return { width: rect.width, height: rect.height };
		};
		return {
			ribbon: box('ribbon'),
			rail: box('slides'),
			thumbnail: box('slide-frame'),
			notes: box('notes'),
			inspector: box('inspector'),
		};
	});
	expect(paint.ribbon.height).toBe(160);
	expect(paint.rail.width).toBe(180);
	expect(paint.thumbnail.width).toBe(134);
	expect(paint.thumbnail.height).toBeCloseTo(76.25, 1);
	expect(paint.notes.height).toBeCloseTo(25.5, 1);
	expect(paint.notes.width).toBe(1440);
	expect(paint.inspector.width).toBe(288);
});

test('the new-slide halves stack and large labelled commands keep Office spacing', async ({
	page,
}) => {
	await loadDeck(page);
	const paint = await page.evaluate(() => {
		const main = document.querySelector('[data-pptx-chrome="split-main"]')!;
		const caret = document.querySelector('[data-pptx-chrome="split-caret"]')!;
		const icon = caret.querySelector('svg')!;
		const iconBox = icon.getBoundingClientRect();
		const caretBox = caret.getBoundingClientRect();
		const tab = document.querySelector(
			'[data-pptx-chrome="ribbon-tabs"] [role="tab"][aria-selected="true"]',
		)!;
		const underline = getComputedStyle(tab, '::after');
		const tabBox = tab.getBoundingClientRect();
		const underlineBottom = tabBox.bottom - Number.parseFloat(underline.bottom);
		let clippedUnderline = false;
		for (let parent = tab.parentElement; parent; parent = parent.parentElement) {
			if (getComputedStyle(parent).overflowY !== 'visible') {
				const bottom = parent.getBoundingClientRect().top + parent.clientTop + parent.clientHeight;
				clippedUnderline ||= underlineBottom > bottom + 0.1;
			}
		}
		const labelled = ['slideTemplates', 'layout', 'reset', 'section'].map((name) => {
			const host = document.querySelector(`[data-ribbon-control="home.slides.${name}"]`)!;
			const button = host.matches('button') ? host : host.querySelector('button')!;
			const style = getComputedStyle(button);
			const svg = button.querySelector('svg')!;
			return {
				display: style.display,
				gap: style.gap,
				iconWidth: svg.getBoundingClientRect().width,
				viewBox: svg.getAttribute('viewBox'),
				strokeWidth: svg.getAttribute('stroke-width'),
			};
		});
		return {
			gap: caret.getBoundingClientRect().top - main.getBoundingClientRect().bottom,
			mainBottomRadius: getComputedStyle(main).borderBottomLeftRadius,
			caretTopRadius: getComputedStyle(caret).borderTopLeftRadius,
			mainTopRadius: getComputedStyle(main).borderTopLeftRadius,
			caretIconCenter: iconBox.left + iconBox.width / 2 - caretBox.left - caretBox.width / 2,
			underlineHeight: underline.height,
			clippedUnderline,
			labelled,
		};
	});
	expect(paint.gap).toBe(0);
	expect(paint.mainBottomRadius).toBe('0px');
	expect(paint.caretTopRadius).toBe('0px');
	expect(paint.mainTopRadius).toBe('4px');
	expect(Math.abs(paint.caretIconCenter)).toBeLessThanOrEqual(0.5);
	expect(paint.underlineHeight).toBe('2.5px');
	expect(paint.clippedUnderline).toBe(false);
	for (const button of paint.labelled) {
		expect(['flex', 'inline-flex']).toContain(button.display);
		expect(button.gap).toBe('2px');
		expect(button.iconWidth).toBe(32);
		expect(button.viewBox).toBe('0 0 24 24');
		expect(button.strokeWidth).toBe('2');
	}
});

test('thumbnail selection keeps the same marker, number and row spacing', async ({ page }) => {
	await loadDeck(page);
	const rows = page.locator('[data-pptx-chrome="slide-row"]');
	const measure = () =>
		page.evaluate(() =>
			Array.from(document.querySelectorAll('[data-pptx-chrome="slide-row"]'))
				.slice(0, 3)
				.map((row) => {
					const box = row.getBoundingClientRect();
					const number = row.querySelector('[data-pptx-chrome="slide-number"]')!;
					const frame = row.querySelector('[data-pptx-chrome="slide-frame"]')!;
					const marker = getComputedStyle(row, '::before');
					return {
						y: box.y,
						height: box.height,
						background: getComputedStyle(row).backgroundColor,
						numberColor: getComputedStyle(number).color,
						numberPadding: getComputedStyle(number).padding,
						numberCenter:
							number.getBoundingClientRect().y +
							number.getBoundingClientRect().height / 2 -
							box.y -
							box.height / 2,
						border: getComputedStyle(frame).borderColor,
						marker: marker.content,
						markerWidth: marker.width,
					};
				}),
		);
	const settleSelection = () =>
		rows.evaluateAll((elements) =>
			Promise.all(
				elements.flatMap((row) => row.getAnimations().map((animation) => animation.finished)),
			),
		);
	await settleSelection();
	const initial = await measure();
	await rows.nth(1).click();
	await expect(rows.nth(1)).toHaveAttribute('aria-current', /^(true|page)$/);
	await settleSelection();
	const changed = await measure();
	expect(changed[1].background).toBe(initial[0].background);
	expect(changed[1].background).not.toBe('rgba(0, 0, 0, 0)');
	expect(changed[1].numberColor).toBe(initial[0].numberColor);
	expect(changed[1].border).toBe(initial[0].border);
	expect(changed[1].markerWidth).toBe('3px');
	expect(changed[0].marker).toBe('none');
	expect(changed[0].background).toBe('rgba(0, 0, 0, 0)');
	for (let i = 0; i < changed.length; i++) {
		expect(changed[i].numberPadding).toBe('0px');
		expect(changed[i].numberCenter).toBeCloseTo(0, 1);
		if (i > 0) {
			expect(changed[i].y - changed[i - 1].y - changed[i - 1].height).toBe(4);
		}
	}
});

test('integer and decimal font sizes leave the toolbar in the same position', async ({ page }) => {
	await loadDeck(page);
	const measure = () =>
		page.evaluate(() => {
			const host = document.querySelector('[data-ribbon-control="home.font.fontSize"]')!;
			const field = host.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
			const bold = document.querySelector('[data-ribbon-control="home.font.bold"]')!;
			const rect = field.getBoundingClientRect();
			const span = field.querySelector<HTMLElement>('[part="value"]')!;
			return {
				value: span.textContent,
				width: rect.width,
				left: rect.left,
				boldLeft: bold.getBoundingClientRect().left,
				clipped: span.scrollWidth > span.clientWidth,
				fontSize: getComputedStyle(field).fontSize,
				lineHeight: getComputedStyle(field).lineHeight,
			};
		});
	await selectElement(page, elementWithText(page, 'Product Overview'));
	await expect(page.locator('[data-font-picker="size"] [part="value"]')).toHaveText('15');
	const integer = await measure();
	expect(integer.value).toBe('15');
	await selectElement(page, elementWithText(page, 'Atlas'));
	await expect(page.locator('[data-font-picker="size"] [part="value"]')).toHaveText('40.5');
	const decimal = await measure();
	expect(decimal.value).toBe('40.5');
	expect(decimal.width).toBe(64);
	expect(decimal.fontSize).toBe('12px');
	expect(decimal.lineHeight).toBe('18px');
	expect(decimal.clipped).toBe(false);
	expect(decimal.width).toBe(integer.width);
	expect(decimal.left).toBe(integer.left);
	expect(decimal.boldLeft).toBe(integer.boldLeft);
});

test('Home keeps Office rows and flat, dimmed disabled actions', async ({ page }) => {
	// Wide enough that no Home group has collapsed into a popup.
	await page.setViewportSize({ width: 1920, height: 1000 });
	await loadDeck(page);
	for (const fontFamily of ['system-ui', 'Arial, sans-serif']) {
		const paint = await page.evaluate((family) => {
			const chrome = document.querySelector<HTMLElement>('[data-pptx-editor-chrome]')!;
			chrome.style.fontFamily = family;
			return {
				backgrounds: [
					'home.font.bold',
					'home.font.increaseFontSize',
					'home.paragraph.decreaseIndent',
					'home.paragraph.alignLeft',
					'home.arrange.sendBackward',
				].map((control) => {
					const button = document.querySelector(`[data-ribbon-control="${control}"]`)!;
					return {
						background: getComputedStyle(button).backgroundColor,
						opacity: getComputedStyle(button).opacity,
					};
				}),
				muted: getComputedStyle(document.querySelector('[data-pptx-editor-chrome]')!)
					.getPropertyValue('--pptx-muted')
					.trim(),
				shapesIconLeft: (() => {
					const host = document.querySelector('[data-ribbon-control="home.drawing.shapes"]')!;
					const button = host.matches('button') ? host : host.querySelector('button')!;
					return (
						button.querySelector('svg')!.getBoundingClientRect().left -
						button.getBoundingClientRect().left
					);
				})(),
				rows: ['font-controls', 'drawing-controls', 'arrange-controls'].map((role) => {
					const row = document.querySelector(`[data-pptx-chrome="${role}"]`)!;
					return {
						height: row.getBoundingClientRect().height,
						wrap: getComputedStyle(row).flexWrap,
					};
				}),
			};
		}, fontFamily);
		for (const action of paint.backgrounds) {
			// Office buttons are flat: no pill behind them, only a dimmed glyph when disabled.
			expect(action.background).toBe('rgba(0, 0, 0, 0)');
			expect(action.opacity).toBe('0.4');
		}
		// Large Shapes: the glyph is centred over the caption, so it sits well inside the button.
		expect(paint.shapesIconLeft).toBeGreaterThan(6);
		const [font, drawing, arrange] = paint.rows;
		// Font is two rows, Drawing a 66px column flow, Arrange the viewer's single flat row.
		expect(font.wrap, fontFamily).toBe('wrap');
		expect(font.height, fontFamily).toBeGreaterThanOrEqual(54);
		expect(drawing.height, fontFamily).toBe(66);
		expect(drawing.wrap).toBe('wrap');
		expect(arrange.wrap).toBe('nowrap');
	}
});
