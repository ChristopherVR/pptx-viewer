import { describe, it, expect } from 'vitest';
import { PptxMarkdownConverter } from './PptxMarkdownConverter';
import type { PptxConverterOptions } from './PptxMarkdownConverter';
import type { PptxData, PptxSlide } from '../core/types/presentation';
import type { PptxElement } from '../core/types/elements';

// ── Helpers ──────────────────────────────────────────────────────────

function makeOptions(
	overrides: Partial<PptxConverterOptions> = {}
): PptxConverterOptions {
	return {
		sourceName: 'test.pptx',
		includeSpeakerNotes: false,
		mediaFolderName: 'media',
		includeMetadata: false,
		...overrides,
	};
}

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide1',
		rId: 'rId2',
		slideNumber: 1,
		elements: [],
		...overrides,
	};
}

function makeTextElement(
	id: string,
	text: string,
	overrides: Record<string, unknown> = {}
): PptxElement {
	return {
		type: 'text',
		id,
		x: 50,
		y: 30,
		width: 400,
		height: 50,
		text,
		textSegments: [{ text, style: { fontSize: 14 } }],
		...overrides,
	} as unknown as PptxElement;
}

function makeData(
	slides: PptxSlide[],
	overrides: Partial<PptxData> = {}
): PptxData {
	return {
		slides,
		width: 960,
		height: 540,
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PptxMarkdownConverter', () => {
	// ── Basic conversion ──

	it('should convert a single empty slide', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([makeSlide()]);
		const result = await converter.convert(data);

		expect(result).toContain('## Slide 1');
		expect(result.endsWith('\n')).toBe(true);
	});

	it('should convert multiple slides separated by horizontal rules', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([
			makeSlide({ id: 's1', slideNumber: 1 }),
			makeSlide({ id: 's2', slideNumber: 2 }),
			makeSlide({ id: 's3', slideNumber: 3 }),
		]);
		const result = await converter.convert(data);

		expect(result).toContain('## Slide 1');
		expect(result).toContain('## Slide 2');
		expect(result).toContain('## Slide 3');
		// Horizontal rules between slides
		const hrCount = (result.match(/\n---\n/g) ?? []).length;
		expect(hrCount).toBeGreaterThanOrEqual(2);
	});

	it('should include slide content from text elements', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ semanticMode: true })
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				elements: [makeTextElement('t1', 'Hello World')],
			}),
		]);
		const result = await converter.convert(data);

		expect(result).toContain('Hello World');
	});

	// ── Slide statistics ──

	it('should track total and converted slide counts', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([
			makeSlide({ slideNumber: 1 }),
			makeSlide({ slideNumber: 2 }),
			makeSlide({ slideNumber: 3 }),
		]);
		await converter.convert(data);

		expect(converter.presentationSlides).toBe(3);
		expect(converter.slidesConverted).toBe(3);
	});

	// ── Slide range filtering ──

	it('should filter slides by range start', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ slideRange: { start: 2 } })
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				elements: [makeTextElement('t1', 'Slide One')],
			}),
			makeSlide({
				slideNumber: 2,
				elements: [makeTextElement('t2', 'Slide Two')],
			}),
			makeSlide({
				slideNumber: 3,
				elements: [makeTextElement('t3', 'Slide Three')],
			}),
		]);
		const result = await converter.convert(data);

		expect(result).not.toContain('## Slide 1');
		expect(result).toContain('## Slide 2');
		expect(result).toContain('## Slide 3');
		expect(converter.slidesConverted).toBe(2);
	});

	it('should filter slides by range end', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ slideRange: { end: 2 } })
		);
		const data = makeData([
			makeSlide({ slideNumber: 1 }),
			makeSlide({ slideNumber: 2 }),
			makeSlide({ slideNumber: 3 }),
		]);
		const result = await converter.convert(data);

		expect(result).toContain('## Slide 1');
		expect(result).toContain('## Slide 2');
		expect(result).not.toContain('## Slide 3');
		expect(converter.slidesConverted).toBe(2);
	});

	it('should filter slides by range start and end', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ slideRange: { start: 2, end: 3 } })
		);
		const data = makeData([
			makeSlide({ slideNumber: 1 }),
			makeSlide({ slideNumber: 2 }),
			makeSlide({ slideNumber: 3 }),
			makeSlide({ slideNumber: 4 }),
		]);
		const result = await converter.convert(data);

		expect(result).not.toContain('## Slide 1');
		expect(result).toContain('## Slide 2');
		expect(result).toContain('## Slide 3');
		expect(result).not.toContain('## Slide 4');
		expect(converter.slidesConverted).toBe(2);
	});

	it('should clamp out-of-bounds range start to 1', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ slideRange: { start: 0 } })
		);
		const data = makeData([
			makeSlide({ slideNumber: 1 }),
			makeSlide({ slideNumber: 2 }),
		]);
		const result = await converter.convert(data);

		expect(result).toContain('## Slide 1');
		expect(converter.slidesConverted).toBe(2);
	});

	it('should clamp out-of-bounds range end to total slides', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ slideRange: { end: 100 } })
		);
		const data = makeData([
			makeSlide({ slideNumber: 1 }),
			makeSlide({ slideNumber: 2 }),
		]);
		const result = await converter.convert(data);

		expect(converter.slidesConverted).toBe(2);
	});

	// ── Front-matter metadata ──

	it('should prepend YAML front-matter when includeMetadata is true', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()]);
		const result = await converter.convert(data);

		expect(result).toMatch(/^---\n/);
		expect(result).toContain('source: "test.pptx"');
		expect(result).toContain('format: "pptx"');
		expect(result).toContain('slides: 1');
		expect(result).toContain('converted:');
	});

	it('should not include front-matter when includeMetadata is false', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: false })
		);
		const data = makeData([makeSlide()]);
		const result = await converter.convert(data);

		expect(result).not.toMatch(/^---\n/);
	});

	it('should include core properties in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			coreProperties: {
				title: 'My Presentation',
				creator: 'John Doe',
				subject: 'Quarterly Review',
				description: 'Q4 results',
				category: 'Business',
				lastModifiedBy: 'Jane Smith',
				revision: '5',
			},
		});
		const result = await converter.convert(data);

		expect(result).toContain('title: "My Presentation"');
		expect(result).toContain('author: "John Doe"');
		expect(result).toContain('subject: "Quarterly Review"');
		expect(result).toContain('description: "Q4 results"');
		expect(result).toContain('category: "Business"');
		expect(result).toContain('lastModifiedBy: "Jane Smith"');
		expect(result).toContain('revision: "5"');
	});

	it('should include app properties in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			appProperties: {
				application: 'Microsoft Office PowerPoint',
				totalTime: 120,
				words: 350,
				paragraphs: 45,
			},
		});
		const result = await converter.convert(data);

		expect(result).toContain(
			'application: "Microsoft Office PowerPoint"'
		);
		expect(result).toContain('editingMinutes: 120');
		expect(result).toContain('words: 350');
		expect(result).toContain('paragraphs: 45');
	});

	it('should include dimensions in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], { width: 1280, height: 720 });
		const result = await converter.convert(data);

		expect(result).toContain('dimensions: "1280x720"');
	});

	it('should include sections in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			sections: [
				{ id: 's1', name: 'Introduction', slideIds: ['1'] },
				{ id: 's2', name: 'Main Content', slideIds: ['2', '3'] },
			],
		});
		const result = await converter.convert(data);

		expect(result).toContain(
			'sections: "Introduction, Main Content"'
		);
	});

	it('should include theme name in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			theme: {
				name: 'Office Theme',
				fontScheme: {
					name: 'Office',
					majorFont: { latin: 'Calibri Light' },
					minorFont: { latin: 'Calibri' },
				},
			} as PptxData['theme'],
		});
		const result = await converter.convert(data);

		expect(result).toContain('theme: "Office Theme"');
		expect(result).toContain(
			'fonts: "Calibri Light, Calibri"'
		);
	});

	it('should include presentation properties in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			presentationProperties: {
				showType: 'kiosk',
				loopContinuously: true,
				advanceMode: 'useTimings',
				showWithNarration: true,
				showWithAnimation: false,
			},
		});
		const result = await converter.convert(data);

		expect(result).toContain('showType: "kiosk"');
		expect(result).toContain('loopContinuously: "true"');
		expect(result).toContain('advanceMode: "useTimings"');
		expect(result).toContain('narration: "enabled"');
		expect(result).toContain('animation: "disabled"');
	});

	it('should include security warnings in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			isPasswordProtected: true,
			hasMacros: true,
		});
		const result = await converter.convert(data);

		expect(result).toContain('warning_passwordProtected');
		expect(result).toContain('warning_macros');
	});

	it('should include custom properties in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			customProperties: [
				{ name: 'Author', value: 'Alice', type: 'string' },
				{ name: 'Version', value: '2.0', type: 'string' },
			],
		});
		const result = await converter.convert(data);

		expect(result).toContain('customProperties: "Author=Alice, Version=2.0"');
	});

	it('should include embedded fonts in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			embeddedFonts: [
				{ name: 'CustomFont', dataUrl: 'data:font/ttf;base64,abc' },
				{ name: 'AnotherFont', dataUrl: 'data:font/ttf;base64,def' },
			],
		});
		const result = await converter.convert(data);

		expect(result).toContain(
			'embeddedFonts: "CustomFont, AnotherFont"'
		);
	});

	it('should include custom shows in front-matter', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ includeMetadata: true })
		);
		const data = makeData([makeSlide()], {
			customShows: [
				{ id: '1', name: 'Executive Summary', slideRIds: ['rId2'] },
				{ id: '2', name: 'Full Deck', slideRIds: ['rId2', 'rId3'] },
			],
		});
		const result = await converter.convert(data);

		expect(result).toContain(
			'customShows: "Executive Summary, Full Deck"'
		);
	});

	// ── Header/footer ──

	it('should render header/footer at the end of the document', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([makeSlide()], {
			headerFooter: {
				hasHeader: true,
				headerText: 'Company Name',
				hasFooter: true,
				footerText: 'Confidential',
				hasDateTime: true,
				dateTimeText: '2024-01-15',
				hasSlideNumber: true,
			},
		});
		const result = await converter.convert(data);

		expect(result).toContain('**Header:** Company Name');
		expect(result).toContain('**Footer:** Confidential');
		expect(result).toContain('**Date/Time:** 2024-01-15');
		expect(result).toContain('**Slide Numbers:** enabled');
	});

	it('should render date format when auto date is enabled', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([makeSlide()], {
			headerFooter: {
				dateTimeAuto: true,
				dateFormat: 'M/d/yyyy',
			},
		});
		const result = await converter.convert(data);

		expect(result).toContain('**Date Format:** M/d/yyyy');
	});

	it('should not render empty header/footer', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([makeSlide()], {
			headerFooter: {
				hasHeader: false,
				hasFooter: false,
			},
		});
		const result = await converter.convert(data);

		expect(result).not.toContain('**Header:**');
		expect(result).not.toContain('**Footer:**');
	});

	// ── Section headings ──

	it('should insert section headings when slides have section names', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ semanticMode: true })
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				sectionName: 'Introduction',
				elements: [makeTextElement('t1', 'Intro content')],
			}),
			makeSlide({
				slideNumber: 2,
				sectionName: 'Introduction',
				elements: [makeTextElement('t2', 'More intro')],
			}),
			makeSlide({
				slideNumber: 3,
				sectionName: 'Main Content',
				elements: [makeTextElement('t3', 'Main stuff')],
			}),
		]);
		const result = await converter.convert(data);

		// Introduction should appear once
		const introMatches = result.match(/# Introduction/g);
		expect(introMatches?.length).toBe(1);
		// Main Content should appear once
		expect(result).toContain('# Main Content');
	});

	it('should use sectionId when sectionName is not available', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ semanticMode: true })
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				sectionId: 'sec_1',
				elements: [makeTextElement('t1', 'Content')],
			}),
		]);
		const result = await converter.convert(data);

		expect(result).toContain('# sec_1');
	});

	// ── Speaker notes ──

	it('should include speaker notes when enabled', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({
				includeSpeakerNotes: true,
				semanticMode: true,
			})
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				notes: 'Remember to pause here',
				elements: [makeTextElement('t1', 'Content')],
			}),
		]);
		const result = await converter.convert(data);

		expect(result).toContain('Remember to pause here');
	});

	it('should omit speaker notes when disabled', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({
				includeSpeakerNotes: false,
				semanticMode: true,
			})
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				notes: 'Secret notes',
				elements: [makeTextElement('t1', 'Content')],
			}),
		]);
		const result = await converter.convert(data);

		expect(result).not.toContain('Secret notes');
	});

	// ── Semantic vs positioned mode ──

	it('should render positioned HTML layout in non-semantic mode', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ semanticMode: false })
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				elements: [makeTextElement('t1', 'Positioned')],
			}),
		]);
		const result = await converter.convert(data);

		expect(result).toContain('position:relative');
		expect(result).toContain('position:absolute');
	});

	it('should render clean markdown in semantic mode', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ semanticMode: true })
		);
		const data = makeData([
			makeSlide({
				slideNumber: 1,
				elements: [makeTextElement('t1', 'Clean markdown')],
			}),
		]);
		const result = await converter.convert(data);

		expect(result).not.toContain('position:relative');
		expect(result).not.toContain('position:absolute');
		expect(result).toContain('Clean markdown');
	});

	// ── Media tracking ──

	it('should report zero images extracted when none present', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([makeSlide()]);
		await converter.convert(data);

		expect(converter.imagesExtracted).toBe(0);
		expect(converter.mediaDir).toBeNull();
	});

	// ── Default dimensions ──

	it('should default to 960x540 when dimensions are zero', async () => {
		const converter = new PptxMarkdownConverter(
			'/out',
			makeOptions({ semanticMode: false })
		);
		const data = makeData(
			[
				makeSlide({
					slideNumber: 1,
					elements: [makeTextElement('t1', 'Default size')],
				}),
			],
			{ width: 0, height: 0 }
		);
		const result = await converter.convert(data);

		// Should still render (using fallback dimensions)
		expect(result).toContain('Default size');
	});

	// ── Output ends with newline ──

	it('should ensure output ends with a newline', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([makeSlide()]);
		const result = await converter.convert(data);

		expect(result.endsWith('\n')).toBe(true);
	});

	// ── Edge case: empty presentation ──

	it('should handle presentation with no slides', async () => {
		const converter = new PptxMarkdownConverter('/out', makeOptions());
		const data = makeData([]);
		const result = await converter.convert(data);

		expect(converter.slidesConverted).toBe(0);
		expect(converter.presentationSlides).toBe(0);
		expect(result.endsWith('\n')).toBe(true);
	});
});
