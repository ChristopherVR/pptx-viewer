/**
 * slide-text-run.component.test.ts
 *
 * `SlideTextRunComponent` renders ONE run (hyperlink / ruby / inline
 * equation / plain span) plus its optional `a:reflection` mirror. No Angular
 * TestBed here, matching every other `*-renderer` component test in this
 * package (see `accessibility-text-panel.component.test.ts`): this pins the
 * source wiring the live renderer AND the reflection mirror both depend on.
 *
 * This component is what closes the "Angular's mirrored text is a simplified
 * re-paint" gap: it is shared verbatim by `SlideTextBlockComponent`, used by
 * both `element-renderer.component.ts` (the live renderer, `interactive`
 * true) and `reflection-mirror-content.component.ts` (the mirror,
 * `interactive` false/default), so ruby annotation, inline equations,
 * tab-stop layout and per-script font pieces reach the mirror too.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function read(file: string): string {
	return readFileSync(path.join(__dirname, file), 'utf8');
}

describe('slideTextRunComponent wiring', () => {
	const source = read('slide-text-run.component.ts');
	const template = source.slice(source.indexOf('template: `'), source.lastIndexOf('`,'));

	it('declares the pptx-slide-text-run selector', () => {
		expect(source).toContain("selector: 'pptx-slide-text-run'");
	});

	it('renders an inline equation via pptx-equation-renderer', () => {
		expect(template).toContain('<pptx-equation-renderer');
		expect(template).toContain('[equationXml]="r.equationXml"');
	});

	it('renders a:ruby as a real <ruby>/<rt>/<rp> annotation, not plain text', () => {
		expect(template).toContain('<ruby');
		expect(template).toContain('<rt');
		expect(template).toContain('r.rubyText');
	});

	it('renders measured tab-stop layout (r.tabLines) instead of plain text', () => {
		expect(template).toContain('r.tabLines');
		expect(template).toContain('piece.leaderStyle');
	});

	it('renders per-script font pieces (r.scriptRuns / r.underlineWordPieces)', () => {
		expect(template).toContain('r.scriptRuns');
		expect(template).toContain('r.underlineWordPieces');
	});

	it('wraps a run in its own nested a:reflection mirror when the run carries one', () => {
		expect(template).toContain('r.reflection');
		expect(template).toContain('pptx-ng-text-reflection');
	});

	it('gates the hyperlink click-confirm handler behind `interactive`, off by default', () => {
		expect(source).toMatch(/readonly interactive = input<boolean>\(false\)/u);
		expect(template).toContain('interactive() ? onHyperlinkClick($event, r.href) : null');
	});
});
