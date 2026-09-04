// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { readEditableText } from './inline-text-extract';

function elementFromHtml(html: string): HTMLElement {
	const container = document.createElement('div');
	container.innerHTML = html;
	return container;
}

describe('readEditableText', () => {
	it('reads plain text with no block structure', () => {
		expect(readEditableText(elementFromHtml('hello world'))).toBe('hello world');
	});

	it('translates <br> into a newline', () => {
		expect(readEditableText(elementFromHtml('line1<br>line2'))).toBe('line1\nline2');
	});

	it('inserts a newline between sibling block elements', () => {
		expect(readEditableText(elementFromHtml('<div>line1</div><div>line2</div>'))).toBe(
			'line1\nline2',
		);
	});

	it('handles <p> blocks the same as <div>', () => {
		expect(readEditableText(elementFromHtml('<p>a</p><p>b</p>'))).toBe('a\nb');
	});

	it('does not double a newline already present before a block', () => {
		expect(readEditableText(elementFromHtml('line1<br><div>line2</div>'))).toBe('line1\nline2');
	});

	it('recurses into nested inline elements', () => {
		expect(readEditableText(elementFromHtml('<div><span>bold</span> text</div>'))).toBe(
			'bold text',
		);
	});

	it('excludes rendered bullet markers from editable text', () => {
		expect(
			readEditableText(
				elementFromHtml(
					'<div><span data-pptx-bullet-marker contenteditable="false">1.</span><span>Item</span></div>',
				),
			),
		).toBe('Item');
	});

	it('keeps paragraph breaks when every paragraph starts with a rendered marker', () => {
		expect(
			readEditableText(
				elementFromHtml(
					'<div><span data-pptx-bullet-marker>1.</span><span>First</span></div><div><span data-pptx-bullet-marker>2.</span><span>Second</span></div>',
				),
			),
		).toBe('First\nSecond');
	});

	it('keeps an annotated rich-run paragraph after its placeholder is replaced', () => {
		expect(
			readEditableText(
				elementFromHtml(
					'<span data-seg-idx="0">First</span><span data-seg-idx="0" data-pptx-paragraph-start>Second</span>',
				),
			),
		).toBe('First\nSecond');
		expect(
			readEditableText(
				elementFromHtml(
					'<span data-seg-idx="0">First</span><span data-seg-idx="0" data-pptx-paragraph-start><br></span>',
				),
			),
		).toBe('First\n');
	});

	it('counts consecutive annotated empty paragraphs exactly once', () => {
		expect(
			readEditableText(
				elementFromHtml(
					'<span>First</span><span data-pptx-paragraph-start><br></span><span data-pptx-paragraph-start><br></span>',
				),
			),
		).toBe('First\n\n');
		expect(
			readEditableText(
				elementFromHtml(
					'<div>First</div><div data-pptx-paragraph-start><span data-seg-idx="0"><br></span></div>',
				),
			),
		).toBe('First\n');
	});

	it('keeps an unannotated authored soft line break', () => {
		expect(readEditableText(elementFromHtml('<div><span data-seg-idx="0"><br></span></div>'))).toBe(
			'\n',
		);
	});

	it('ignores an empty-run caret placeholder but reads replacement text', () => {
		expect(
			readEditableText(elementFromHtml('<span>First</span><span data-pptx-empty-run><br></span>')),
		).toBe('First');
		expect(
			readEditableText(
				elementFromHtml('<span>First</span><span data-pptx-empty-run>Second</span>'),
			),
		).toBe('FirstSecond');
	});

	it('does not prefix a newline for the very first block', () => {
		expect(readEditableText(elementFromHtml('<div>only</div>'))).toBe('only');
	});

	it('returns an empty string for an empty root', () => {
		expect(readEditableText(elementFromHtml(''))).toBe('');
	});
});
