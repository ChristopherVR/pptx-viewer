import { describe, expect, it } from 'vitest';

import { buildTextStyleOverrideCss } from './animation-text-style-css';

describe('buildTextStyleOverrideCss', () => {
	it('returns undefined when there is no active text-style override', () => {
		expect(buildTextStyleOverrideCss('el1', undefined)).toBeUndefined();
	});

	it('returns undefined when the descriptor carries no recognised fields', () => {
		expect(buildTextStyleOverrideCss('el1', {})).toBeUndefined();
	});

	it('builds a scoped !important rule for bold, mirrored onto the SVG text/tspan rule', () => {
		const css = buildTextStyleOverrideCss('el1', { bold: true });
		expect(css).toBe(
			'[data-element-id="el1"] [style] { font-weight: bold !important; }\n' +
				'[data-element-id="el1"] text, [data-element-id="el1"] tspan { font-weight: bold !important; }',
		);
	});

	it('builds a rule reverting bold/italic/underline to their neutral values', () => {
		const css = buildTextStyleOverrideCss('el1', { bold: false, italic: false, underline: false });
		expect(css).toBe(
			'[data-element-id="el1"] [style] { font-weight: normal !important; font-style: normal !important; text-decoration-line: none !important; }\n' +
				'[data-element-id="el1"] text, [data-element-id="el1"] tspan { font-weight: normal !important; font-style: normal !important; text-decoration-line: none !important; }',
		);
	});

	it('builds a relative font-size override from fontScale', () => {
		const css = buildTextStyleOverrideCss('el1', { fontScale: 2 });
		expect(css).toBe(
			'[data-element-id="el1"] [style] { font-size: calc(1em * 2) !important; }\n' +
				'[data-element-id="el1"] text, [data-element-id="el1"] tspan { font-size: calc(1em * 2) !important; }',
		);
	});

	it('ignores a non-finite or non-positive fontScale', () => {
		expect(buildTextStyleOverrideCss('el1', { fontScale: 0 })).toBeUndefined();
		expect(buildTextStyleOverrideCss('el1', { fontScale: Number.NaN })).toBeUndefined();
	});

	it('builds a colour override as `color` for HTML text and `fill` for SVG text', () => {
		const css = buildTextStyleOverrideCss('el1', { color: '#ff0000' });
		expect(css).toBe(
			'[data-element-id="el1"] [style] { color: #ff0000 !important; }\n' +
				'[data-element-id="el1"] text, [data-element-id="el1"] tspan { fill: #ff0000 !important; }',
		);
	});

	it('does not use a `*` selector, so the SVG rule cannot paint non-text shapes', () => {
		const css = buildTextStyleOverrideCss('el1', { color: '#ff0000' });
		expect(css).not.toContain('*');
		expect(css).toContain('text, [data-element-id="el1"] tspan');
	});

	it('escapes a quote in the element id in both rules', () => {
		const css = buildTextStyleOverrideCss('el"1', { bold: true });
		expect(css).toBe(
			'[data-element-id="el\\"1"] [style] { font-weight: bold !important; }\n' +
				'[data-element-id="el\\"1"] text, [data-element-id="el\\"1"] tspan { font-weight: bold !important; }',
		);
	});
});
