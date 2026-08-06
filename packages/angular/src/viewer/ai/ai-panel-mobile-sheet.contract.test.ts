/**
 * Mobile AI bottom-sheet geometry contract.
 *
 * On a phone viewport the AI pane must be an overlay bottom sheet pinned to
 * the bottom of the positioned `.pptx-ng-body` (React/Vue parity:
 * `absolute inset-x-0 bottom-0 top-auto h-[75dvh]`). As an in-flow flex
 * sibling it stacked after the canvas, so the sheet opened with its top at
 * ~56% of the viewport while its 75dvh height pushed ~280px, including the
 * composer, below the fold and unreachable. Angular has no TestBed here (see
 * `vitest.config.ts`), and media-query CSS is invisible to jsdom anyway, so
 * the guard reads the stylesheet source, as
 * `editor-context-menu.contract.test.ts` does.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
	path.join(import.meta.dirname, '..', '..', 'styles', 'pptx-angular-viewer.css'),
	'utf8',
);

/** The `.pptx-ng-ai-panel` mobile rule body (declarations between the braces). */
function aiPanelRule(): string {
	const match = CSS.match(/\.pptx-ng-ai-panel\s*\{([^}]*)\}/u);
	expect(match, 'mobile .pptx-ng-ai-panel rule must exist').not.toBeNull();
	return match?.[1] ?? '';
}

describe('mobile AI bottom-sheet geometry', () => {
	it('pins the sheet to the bottom as an overlay, not a flex sibling', () => {
		const rule = aiPanelRule();
		expect(rule).toContain('position: absolute');
		expect(rule).toContain('bottom: 0');
		expect(rule).toContain('top: auto');
		expect(rule).toContain('inset-inline: 0');
		expect(rule).not.toContain('flex:');
	});

	it('bounds the sheet height so the composer stays on screen', () => {
		const rule = aiPanelRule();
		const height = rule.match(/(?<!max-)height:\s*(\d+)dvh/u);
		const maxHeight = rule.match(/max-height:\s*(\d+)dvh/u);
		expect(height).not.toBeNull();
		expect(maxHeight).not.toBeNull();
		expect(Number(height?.[1])).toBeLessThanOrEqual(90);
		expect(Number(maxHeight?.[1])).toBeLessThanOrEqual(90);
	});

	it('stacks the sheet above the canvas', () => {
		expect(aiPanelRule()).toContain('z-index: 30');
	});
});
