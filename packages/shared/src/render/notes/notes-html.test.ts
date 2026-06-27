import type { TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { segmentsToEditorHtml } from './notes-html';

describe('segmentsToEditorHtml', () => {
	it('renders a single plain text segment as a wrapped div with span', () => {
		const segments: TextSegment[] = [{ text: 'Hello', style: {} }];
		const html = segmentsToEditorHtml(segments);
		expect(html).toContain('<span>Hello</span>');
		expect(html).toMatch(/^<div>/u);
		expect(html).toMatch(/<\/div>$/u);
	});

	it('renders bold/italic/underline/strike inline styles', () => {
		expect(segmentsToEditorHtml([{ text: 'B', style: { bold: true } }])).toContain(
			'font-weight:700',
		);
		expect(segmentsToEditorHtml([{ text: 'I', style: { italic: true } }])).toContain(
			'font-style:italic',
		);
		expect(segmentsToEditorHtml([{ text: 'U', style: { underline: true } }])).toContain(
			'text-decoration:underline',
		);
		expect(segmentsToEditorHtml([{ text: 'S', style: { strikethrough: true } }])).toContain(
			'text-decoration:line-through',
		);
	});

	it('renders color, fontSize, and fontFamily inline styles', () => {
		expect(segmentsToEditorHtml([{ text: 'R', style: { color: '#ff0000' } }])).toContain(
			'color:#ff0000',
		);
		expect(segmentsToEditorHtml([{ text: 'Big', style: { fontSize: 24 } }])).toContain(
			'font-size:24pt',
		);
		expect(segmentsToEditorHtml([{ text: 'F', style: { fontFamily: 'Arial' } }])).toContain(
			'font-family:Arial',
		);
	});

	it('renders safe hyperlinks as anchor tags with data-hyperlink', () => {
		const html = segmentsToEditorHtml([
			{ text: 'Click me', style: { hyperlink: 'https://example.com' } },
		]);
		expect(html).toContain('<a href="https://example.com"');
		expect(html).toContain('Click me</a>');
		expect(html).toContain('data-hyperlink="https://example.com"');
	});

	it('does not emit an anchor for an unsafe hyperlink scheme', () => {
		// Build the scheme so the `javascript:` literal does not appear in source.
		const unsafe = `${'java'}script:alert(1)`;
		const html = segmentsToEditorHtml([{ text: 'evil', style: { hyperlink: unsafe } }]);
		expect(html).not.toContain('<a ');
		expect(html).toContain('<span>evil</span>');
	});

	it('escapes HTML special characters in text content', () => {
		const html = segmentsToEditorHtml([{ text: '<script>alert("xss")</script>', style: {} }]);
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('&quot;xss&quot;');
		expect(html).not.toContain('<script>');
	});

	it('separates paragraphs into separate div elements', () => {
		const html = segmentsToEditorHtml([
			{ text: 'Paragraph 1', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'Paragraph 2', style: {} },
		]);
		expect(html.match(/<div/gu)).toHaveLength(2);
	});

	it('renders bullet and numbered list prefixes with data attributes', () => {
		const bullet = segmentsToEditorHtml([{ text: 'Item', style: {}, bulletInfo: { char: '•' } }]);
		expect(bullet).toContain('data-bullet-type="bullet"');
		expect(bullet).toContain('contenteditable="false"');

		const numbered = segmentsToEditorHtml([
			{ text: 'First', style: {}, bulletInfo: { autoNumType: 'arabicPeriod' } },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'Second', style: {}, bulletInfo: { autoNumType: 'arabicPeriod' } },
		]);
		expect(numbered).toContain('data-bullet-type="numbered"');
		expect(numbered).toContain('1.');
		expect(numbered).toContain('2.');
	});

	it('renders indented paragraphs with padding-left and data attribute', () => {
		const html = segmentsToEditorHtml([{ text: 'Indented', style: { paragraphMarginLeft: 48 } }]);
		expect(html).toContain('data-indent-level="2"');
		expect(html).toContain('padding-left:48px');
	});
});
