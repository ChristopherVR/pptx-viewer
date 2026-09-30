// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';

import { EDITOR_THUMBNAIL_CSS } from './thumbnail-css';

afterEach(() => document.body.replaceChildren());

function paintRules(current: string | null) {
	const style = document.createElement('style');
	style.textContent = EDITOR_THUMBNAIL_CSS;
	const host = document.createElement('div');
	host.dataset.pptxEditorChrome = '';
	host.innerHTML =
		'<button data-pptx-chrome="slide-row"><span data-pptx-chrome="slide-number">2</span><span data-pptx-chrome="slide-frame"></span></button>';
	document.body.append(style, host);
	const row = host.querySelector('button')!;
	if (current !== null) {
		row.setAttribute('aria-current', current);
	}
	const media = style.sheet!.cssRules[0] as CSSMediaRule;
	const rules = Array.from(media.cssRules) as CSSStyleRule[];
	const declarations = (element: Element, property: string): string[] =>
		rules
			.filter((rule) => !rule.selectorText.includes('::') && element.matches(rule.selectorText))
			.map((rule) => rule.style.getPropertyValue(property))
			.filter(Boolean);
	const marker = rules.find(
		(rule) =>
			rule.selectorText.endsWith('::before') &&
			row.matches(rule.selectorText.replace('::before', '')),
	)?.style;
	return { row, declarations, marker };
}

describe('thumbnail selection stylesheet', () => {
	it.each(['true', 'page'])('paints every active cue for aria-current=%s', (current) => {
		const { row, declarations, marker } = paintRules(current);
		// Happy DOM does not parse color-mix. The browser spec verifies its paint.
		expect(marker?.width).toBe('3px');
		expect(marker?.content).toBe('""');
		expect(
			declarations(row.querySelector('[data-pptx-chrome="slide-number"]')!, 'color').at(-1),
		).toBe('var(--pptx-primary)');
		expect(
			declarations(row.querySelector('[data-pptx-chrome="slide-number"]')!, 'font-weight').at(-1),
		).toBe('500');
	});

	it.each([null, 'false'])('leaves a non-current row unhighlighted (%s)', (current) => {
		const { row, declarations } = paintRules(current);
		expect(declarations(row, 'background').at(-1)).toBe('transparent');
		expect(
			declarations(row.querySelector('[data-pptx-chrome="slide-number"]')!, 'color'),
		).toStrictEqual([]);
	});
});
