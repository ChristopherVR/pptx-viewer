import { describe, it, expect } from 'vitest';
import { TextSegmentRenderer } from './TextSegmentRenderer';
import type { TextSegment } from '../core';

describe('TextSegmentRenderer', () => {
	const renderer = new TextSegmentRenderer();

	function seg(text: string, style: TextSegment['style'] = {}): TextSegment {
		return { text, style };
	}

	function paraBreak(): TextSegment {
		return { text: '', style: {}, isParagraphBreak: true };
	}

	it('should render plain text segments', () => {
		const result = renderer.render([seg('Hello world')]);
		expect(result).toBe('Hello world');
	});

	it('should return empty string for empty segments', () => {
		expect(renderer.render([])).toBe('');
	});

	it('should concatenate segments within the same paragraph', () => {
		const result = renderer.render([seg('Hello '), seg('world')]);
		expect(result).toBe('Hello world');
	});

	it('should separate paragraphs with double newline', () => {
		const result = renderer.render([
			seg('First'),
			paraBreak(),
			seg('Second'),
		]);
		expect(result).toBe('First\n\nSecond');
	});

	it('should render bold text with markdown bold markers', () => {
		const result = renderer.render([seg('bold', { bold: true })]);
		expect(result).toBe('**bold**');
	});

	it('should render italic text with markdown italic markers', () => {
		const result = renderer.render([seg('italic', { italic: true })]);
		expect(result).toBe('*italic*');
	});

	it('should render bold+italic with triple markers', () => {
		const result = renderer.render([
			seg('both', { bold: true, italic: true }),
		]);
		expect(result).toBe('***both***');
	});

	it('should render strikethrough text', () => {
		const result = renderer.render([
			seg('deleted', { strikethrough: true }),
		]);
		expect(result).toBe('~~deleted~~');
	});

	it('should render underline text with <u> tags', () => {
		const result = renderer.render([seg('under', { underline: true })]);
		expect(result).toBe('<u>under</u>');
	});

	it('should render hyperlinks as markdown links', () => {
		const result = renderer.render([
			seg('click me', { hyperlink: 'https://example.com' }),
		]);
		expect(result).toBe('[click me](https://example.com)');
	});

	it('should render superscript via baseline > 0', () => {
		const result = renderer.render([seg('2', { baseline: 30 })]);
		expect(result).toBe('<sup>2</sup>');
	});

	it('should render subscript via baseline < 0', () => {
		const result = renderer.render([seg('n', { baseline: -25 })]);
		expect(result).toBe('<sub>n</sub>');
	});

	it('should escape markdown special characters in plain text', () => {
		const result = renderer.render([seg('a*b')]);
		expect(result).toContain('\\*');
	});

	it('should render equation segments wrapped in dollar signs', () => {
		const result = renderer.render([
			{
				text: '',
				style: {},
				equationXml: { 'm:r': { 'm:t': 'E=mc^2' } },
			},
		]);
		expect(result).toContain('$');
		expect(result).toContain('E=mc^2');
	});

	it('should collapse adjacent bold markers', () => {
		// Two adjacent bold segments should merge markers via regex
		const result = renderer.render([
			seg('Hello', { bold: true }),
			seg(' World', { bold: true }),
		]);
		// After joining: **Hello**** World** => collapses **** to nothing
		expect(result).toBe('**Hello World**');
	});

	describe('plainText', () => {
		it('should strip formatting and return plain content', () => {
			const result = renderer.plainText([
				seg('Hello ', { bold: true }),
				seg('world', { italic: true }),
			]);
			expect(result).toBe('Hello world');
		});

		it('should join multiple paragraphs with space', () => {
			const result = renderer.plainText([
				seg('First'),
				paraBreak(),
				seg('Second'),
			]);
			expect(result).toBe('First Second');
		});
	});

	describe('renderInline', () => {
		it('should join paragraphs with <br /> in inline mode', () => {
			const result = renderer.renderInline([
				seg('Line 1'),
				paraBreak(),
				seg('Line 2'),
			]);
			expect(result).toBe('Line 1<br />Line 2');
		});
	});

	describe('HTML formatting mode', () => {
		it('should use <strong> for bold when htmlFormatting is enabled', () => {
			const result = renderer.render(
				[seg('bold', { bold: true })],
				{ htmlFormatting: true },
			);
			expect(result).toBe('<strong>bold</strong>');
		});

		it('should use <em> for italic when htmlFormatting is enabled', () => {
			const result = renderer.render(
				[seg('italic', { italic: true })],
				{ htmlFormatting: true },
			);
			expect(result).toBe('<em>italic</em>');
		});

		it('should escape HTML entities', () => {
			const result = renderer.render(
				[seg('<script>alert("hi")</script>')],
				{ htmlFormatting: true },
			);
			expect(result).toContain('&lt;');
			expect(result).toContain('&gt;');
			expect(result).not.toContain('<script>');
		});
	});

	describe('field segments', () => {
		it('should resolve slidenum field to the provided slide number', () => {
			const result = renderer.render(
				[{ text: '#', style: {}, fieldType: 'slidenum' }],
				{ slideNumber: 5 },
			);
			expect(result).toBe('5');
		});

		it('should resolve datetime field to provided dateTimeText', () => {
			const result = renderer.render(
				[{ text: '1/1/2000', style: {}, fieldType: 'datetime' }],
				{ dateTimeText: '2026-03-10' },
			);
			expect(result).toBe('2026-03-10');
		});
	});

	describe('text caps', () => {
		it('should uppercase text when textCaps is "all"', () => {
			const result = renderer.render([
				seg('hello', { textCaps: 'all' }),
			]);
			expect(result).toBe('HELLO');
		});

		it('should wrap in small-caps span when textCaps is "small"', () => {
			const result = renderer.render([
				seg('hello', { textCaps: 'small' }),
			]);
			expect(result).toContain('font-variant:small-caps');
		});
	});

	describe('picture bullets', () => {
		it('should use default "-" marker for picture bullets with imageDataUrl', () => {
			const segments: TextSegment[] = [
				{
					text: 'Item with picture bullet',
					style: {},
					bulletInfo: {
						imageRelId: 'rId5',
						imageDataUrl: 'data:image/png;base64,iVBOR',
					},
				},
			];
			const result = renderer.render(segments);
			expect(result).toBe('- Item with picture bullet');
		});

		it('should use default "-" marker for picture bullets with only imageRelId', () => {
			const segments: TextSegment[] = [
				{
					text: 'Item with picture bullet',
					style: {},
					bulletInfo: {
						imageRelId: 'rId5',
					},
				},
			];
			const result = renderer.render(segments);
			expect(result).toBe('- Item with picture bullet');
		});
	});
});
