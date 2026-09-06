/**
 * Unit tests for `a:linkedTxbx` overflow in `ElementRendererComponent`.
 *
 * A text box in a linked chain paints only the slice of the chain's text that
 * the boxes before it could not hold. Two things need to hold for that: the
 * shared distribution rule (which all five bindings share), and the wiring that
 * hands this component its SIBLINGS, without which the rule can never fire.
 *
 * TestBed rendering is unavailable in this package (it needs
 * `@analogjs/vite-plugin-angular`; see `vitest.config.ts`), so the component is
 * not instantiated and reading the source is the only seam available for the
 * wiring half. The binding no longer has its own paragraph builder (it hands
 * the resolved slice to shared `buildParagraphs` via `buildAngularParagraphs`),
 * so what is left to pin here is that the slice reaches it at all.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxElement, PptxElementWithText, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTextBlockStyle, getOverflowSegments } from '../internal/shared';
import { componentSource } from './component-source.test-support';

const here = dirname(fileURLToPath(import.meta.url));
const rendererSource = componentSource(here, 'element-renderer.component.ts');
// The text/shape branch (where the linked-chain slice is actually resolved
// and handed to the shared paragraph builder) is split out to
// `ElementRendererShapeComponent`.
const shapeSource = componentSource(here, 'element-renderer-shape.component.ts');
const canvasSource = componentSource(here, 'slide-canvas.component.ts');

/**
 * A box small enough that the core capacity estimate resolves to exactly 3
 * characters: 60x30px minus the default 7px insets leaves 46x16px, and an 18pt
 * (24px) font fits floor(46 / (24 * 0.6)) = 3 chars on the one line available.
 */
function linkedBox(id: string, seq: number, segments?: TextSegment[]): PptxElement {
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 60,
		height: 30,
		textStyle: { fontSize: 18 },
		linkedTxbxId: 7,
		linkedTxbxSeq: seq,
		...(segments ? { textSegments: segments } : {}),
	} as PptxElementWithText as PptxElement;
}

/** Head holds the chain's whole text; the tail is authored empty, as PowerPoint writes it. */
function chainElements(): PptxElement[] {
	return [linkedBox('head', 0, [{ text: 'ABCDEFGHIJ', style: {} }]), linkedBox('tail', 1)];
}

describe('the shared rule the renderer delegates to', () => {
	it('splits the chain text so each box renders only its own slice', () => {
		const [head, tail] = chainElements();
		expect(getOverflowSegments(head, [head, tail])?.map((s) => s.text)).toStrictEqual(['ABC']);
		expect(getOverflowSegments(tail, [head, tail])?.map((s) => s.text)).toStrictEqual(['DEFGHIJ']);
	});

	it('leaves an element outside a chain on its own segments', () => {
		const plain = {
			type: 'text',
			id: 'plain',
			x: 0,
			y: 0,
			width: 300,
			height: 200,
			textSegments: [{ text: 'Hello world', style: {} }],
		} as PptxElementWithText as PptxElement;
		expect(getOverflowSegments(plain, [plain])).toBeUndefined();
	});

	it('clips a chain member, so its overflow is not painted twice', () => {
		const [head] = chainElements();
		expect(buildTextBlockStyle(head).overflow).toBe('hidden');
	});
});

describe('elementRenderer linked text box wiring', () => {
	it('resolves the rendered segments through the shared helper, not the raw field', () => {
		expect(shapeSource).toContain(
			'getOverflowSegments(el, this.slideElements()) ?? el.textSegments',
		);
	});

	// The resolved slice has to be handed to the SHARED builder as its segment
	// override; passing it anywhere else (or rebuilding paragraphs locally) is
	// how this binding drifted from the other four before.
	it('builds its paragraphs from shared buildParagraphs, not a local copy', () => {
		expect(shapeSource).toContain('buildAngularParagraphs(el, this.fieldContext(), segments)');
		expect(shapeSource).not.toContain('resolveParagraphSpacing');
		expect(shapeSource).not.toContain('splitStyledRun');
	});

	it('accepts the sibling list the rule needs', () => {
		expect(rendererSource).toMatch(/readonly slideElements = input<readonly PptxElement\[\]>/u);
	});

	// A chain authored inside a group must still resolve against the SLIDE, so
	// the recursion has to forward the list rather than restart it from the group.
	it('forwards the sibling list into recursive group children', () => {
		const groupBranch = rendererSource.slice(rendererSource.indexOf('pptx-element-renderer'));
		expect(groupBranch).toContain('[slideElements]="slideElements()"');
	});
});

describe('slideCanvas linked text box wiring', () => {
	// Both the template layer and the slide's own elements are bound, and both to
	// `allElements()`: a chain resolves against every box on the surface, so
	// binding only one layer would break a chain that spans the two.
	it('binds the sibling list on every element renderer it hosts', () => {
		const bindings = canvasSource.match(/\[slideElements\]="allElements\(\)"/gu) ?? [];
		expect(bindings).toHaveLength(2);
	});
});
