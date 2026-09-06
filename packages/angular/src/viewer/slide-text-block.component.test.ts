/**
 * slide-text-block.component.test.ts
 *
 * `SlideTextBlockComponent` renders an element's paragraphs (bullet markers,
 * hanging indents, staged text builds), delegating each run to
 * `SlideTextRunComponent`. Shared verbatim by `ElementRendererComponent` (the
 * live renderer) and `ReflectionMirrorContentComponent` (the mirror), so a
 * reflected shape's text reaches full fidelity instead of a second,
 * simplified re-paint. No Angular TestBed here, matching every other
 * `*-renderer` component test in this package.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function read(file: string): string {
	return readFileSync(path.join(__dirname, file), 'utf8');
}

describe('slideTextBlockComponent wiring', () => {
	const source = read('slide-text-block.component.ts');
	const template = source.slice(source.indexOf('template: `'), source.lastIndexOf('`,'));

	it('declares the pptx-slide-text-block selector', () => {
		expect(source).toContain("selector: 'pptx-slide-text-block'");
	});

	it('delegates every run to pptx-slide-text-run, forwarding `interactive`', () => {
		expect(template).toContain('<pptx-slide-text-run');
		expect(template).toContain('[interactive]="interactive()"');
	});

	it('defaults interactive to false, so the mirror stays inert unless the live renderer opts in', () => {
		expect(source).toMatch(/readonly interactive = input<boolean>\(false\)/u);
	});

	it('renders a hard line break for a newline run instead of delegating it to the run component', () => {
		expect(template).toContain('run.text === newlineRun');
		expect(template).toContain('<br />');
	});

	it('builds the staged text-build split only when elementId is present (absent for the mirror)', () => {
		expect(source).toContain('const id = this.elementId();');
		expect(source).toContain('if (!id) {');
	});

	it('renders bullet marker / picture and paragraph spacing', () => {
		expect(template).toContain('para.bulletMarker');
		expect(template).toContain('para.bulletPicture');
		expect(template).toContain('para.spaceBeforePx');
		expect(template).toContain('para.spaceAfterPx');
	});
});

describe('elementRendererComponent wires SlideTextBlockComponent as interactive, keyed by elementId', () => {
	const html = read('element-renderer.component.html');
	const ts = read('element-renderer.component.ts');
	// The plain-text mount point lives in the text/shape branch, split out to
	// `ElementRendererShapeComponent`; see that component's doc.
	const shapeHtml = read('element-renderer-shape.component.html');
	const shapeTs = read('element-renderer-shape.component.ts');

	it('mounts pptx-slide-text-block for the plain-text case', () => {
		expect(shapeHtml).toContain('<pptx-slide-text-block');
		expect(shapeHtml).toContain('[elementId]="element().id"');
		expect(shapeHtml).toContain('[interactive]="true"');
	});

	it('imports SlideTextBlockComponent (not the removed inline runBase/runContent templates)', () => {
		expect(shapeTs).toContain('SlideTextBlockComponent');
		expect(html).not.toContain('#runBase');
		expect(html).not.toContain('#runContent');
		expect(shapeHtml).not.toContain('#runBase');
		expect(shapeHtml).not.toContain('#runContent');
	});

	it('forwards live per-sub-element animation states for staged text builds', () => {
		expect(html).toContain('[subElementAnimStates]="subElementAnimStates()"');
		expect(ts).toContain('readonly subElementAnimStates = computed(');
	});
});
