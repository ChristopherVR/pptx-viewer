import { describe, expect, it } from 'vitest';

import { buildViewerCss } from './css';

/**
 * The slide surface must not inherit the CHROME's typography.
 *
 * `.pptxv` declares `font-size: 14px` for the ribbon, panels and status bar.
 * That cascaded straight into slide content that authors no size of its own,
 * so a table cell with no `sz` rendered at 14px here and at the document
 * default (16px) in the other four bindings: the same deck measured a
 * different type scale per binding, which the cross-binding parity harness
 * reported as a line-height drift on every table slide.
 */
describe('slide stage typography', () => {
	const css = buildViewerCss();

	it('restates a font-size on the stage so chrome typography cannot cascade in', () => {
		expect(css).toContain('.pptxv-stage { background: #fff; font-size: 16px; }');
	});

	it('still sets the chrome font-size on the viewer root', () => {
		// The stage rule is a shield, not a replacement: the chrome keeps its own
		// 14px scale, and this pins that both facts stay true together.
		expect(css).toMatch(/\.pptxv \{[^}]*font-size: 14px;/u);
	});
});
