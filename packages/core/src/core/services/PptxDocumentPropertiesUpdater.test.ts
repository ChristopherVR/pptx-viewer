import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import JSZip from 'jszip';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PptxElement, PptxSlide } from '../types';
import { PptxDocumentPropertiesUpdater } from './PptxDocumentPropertiesUpdater';
import type { PptxDocumentPropertiesUpdaterContext } from './PptxDocumentPropertiesUpdater';

const xmlParserOptions = {
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
};

function createContext(): PptxDocumentPropertiesUpdaterContext {
	return {
		zip: new JSZip(),
		parser: new XMLParser(xmlParserOptions),
		builder: new XMLBuilder(xmlParserOptions),
	};
}

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'ppt/slides/slide1.xml',
		rId: 'rId1',
		slideNumber: 1,
		hidden: false,
		elements: [],
		rawXml: {},
		...overrides,
	} as PptxSlide;
}

/** A slide carrying a single title-placeholder element with the given text. */
function makeTitleSlide(title: string, slideNumber: number): PptxSlide {
	const titleElement = {
		id: `title-${slideNumber}`,
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: title,
		placeholderType: 'title',
	} as unknown as PptxElement;
	return makeSlide({
		id: `ppt/slides/slide${slideNumber}.xml`,
		slideNumber,
		elements: [titleElement],
	});
}

const APP_XML_WITH_TITLES = `<?xml version="1.0"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Slides>2</Slides>
  <HiddenSlides>0</HiddenSlides>
  <Notes>0</Notes>
  <HeadingPairs>
    <vt:vector size="4" baseType="variant">
      <vt:variant><vt:lpstr>Theme</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
      <vt:variant><vt:lpstr>Slide Titles</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>2</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="3" baseType="lpstr">
      <vt:lpstr>Office Theme</vt:lpstr>
      <vt:lpstr>Old Slide 1</vt:lpstr>
      <vt:lpstr>Old Slide 2</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
</Properties>`;

interface ParsedVector {
	'@_size'?: string | number;
	'@_baseType'?: string;
	'vt:variant'?: Array<Record<string, unknown>>;
	'vt:lpstr'?: unknown;
}

function readTitlesOfParts(props: Record<string, unknown>): {
	size: string;
	entries: string[];
} {
	const vector = (props['TitlesOfParts'] as Record<string, unknown>)['vt:vector'] as ParsedVector;
	const raw = vector['vt:lpstr'];
	const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
	return { size: String(vector['@_size']), entries: list.map((v) => String(v)) };
}

function readSlideTitleCount(props: Record<string, unknown>): number {
	const vector = (props['HeadingPairs'] as Record<string, unknown>)['vt:vector'] as ParsedVector;
	const variants = vector['vt:variant'] ?? [];
	for (let i = 0; i + 1 < variants.length; i += 2) {
		const name = String((variants[i] as Record<string, unknown>)['vt:lpstr'] ?? '').toLowerCase();
		if (name.includes('slide') && name.includes('title')) {
			return Number((variants[i + 1] as Record<string, unknown>)['vt:i4']);
		}
	}
	return -1;
}

describe('pptxDocumentPropertiesUpdater', () => {
	let context: PptxDocumentPropertiesUpdaterContext;
	let updater: PptxDocumentPropertiesUpdater;

	beforeEach(() => {
		context = createContext();
		updater = new PptxDocumentPropertiesUpdater(context);
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	// ── updateOnSave: core properties ────────────────────────────────

	describe('updateOnSave — core properties', () => {
		it('increments the revision number', async () => {
			const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>3</cp:revision>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
			context.zip.file('docProps/core.xml', coreXml);

			await updater.updateOnSave([makeSlide()]);

			const updatedXml = await context.zip.file('docProps/core.xml')!.async('string');
			expect(updatedXml).toContain('4'); // revision 3 -> 4
		});

		it('sets revision to 1 when no valid revision exists', async () => {
			const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
			context.zip.file('docProps/core.xml', coreXml);

			await updater.updateOnSave([makeSlide()]);

			const updatedXml = await context.zip.file('docProps/core.xml')!.async('string');
			// Should contain revision of "1"
			expect(updatedXml).toContain('1');
		});

		it('updates the modified date', async () => {
			const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>1</cp:revision>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
			context.zip.file('docProps/core.xml', coreXml);

			await updater.updateOnSave([makeSlide()]);

			const updatedXml = await context.zip.file('docProps/core.xml')!.async('string');
			// Should no longer have the old date
			expect(updatedXml).not.toContain('2024-01-01T00:00:00Z');
		});

		it('applies core property overrides', async () => {
			const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>1</cp:revision>
          <dc:title>Old Title</dc:title>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
			context.zip.file('docProps/core.xml', coreXml);

			await updater.updateOnSave([makeSlide()], {
				coreProperties: {
					title: 'New Title',
					creator: 'Test Author',
				},
			});

			const updatedXml = await context.zip.file('docProps/core.xml')!.async('string');
			expect(updatedXml).toContain('New Title');
			expect(updatedXml).toContain('Test Author');
		});
	});

	// ── updateOnSave: app properties ──────────────────────────────────

	describe('updateOnSave — app properties', () => {
		it('updates slide count in app properties', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			const slides = [makeSlide(), makeSlide({ id: 's2', slideNumber: 2 })];
			await updater.updateOnSave(slides);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			expect(updatedXml).toContain('2'); // 2 slides
		});

		it('counts hidden slides', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>2</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			const slides = [
				makeSlide({ hidden: true }),
				makeSlide({ id: 's2', slideNumber: 2, hidden: false }),
			];
			await updater.updateOnSave(slides);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			// Should reflect 1 hidden slide
			const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
			const props = parsed['Properties'] as Record<string, unknown>;
			expect(String(props['HiddenSlides'])).toBe('1');
		});

		it('counts slides with notes', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>2</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			const slides = [
				makeSlide({ notes: 'Speaker notes here' }),
				makeSlide({ id: 's2', slideNumber: 2, notes: '' }),
			];
			await updater.updateOnSave(slides);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
			const props = parsed['Properties'] as Record<string, unknown>;
			expect(String(props['Notes'])).toBe('1');
		});

		it('applies app property overrides', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
          <Company>OldCo</Company>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			await updater.updateOnSave([makeSlide()], {
				appProperties: {
					company: 'NewCo',
					application: 'TestApp',
				},
			});

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			expect(updatedXml).toContain('NewCo');
			expect(updatedXml).toContain('TestApp');
		});

		it('does nothing when app.xml is missing', async () => {
			// No docProps/app.xml in the zip
			const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>1</cp:revision>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
			context.zip.file('docProps/core.xml', coreXml);

			// Should not throw
			await updater.updateOnSave([makeSlide()]);
		});
	});

	// ── updateOnSave: slide titles (TitlesOfParts / HeadingPairs) ──────

	describe('updateOnSave — slide titles', () => {
		it('recomputes TitlesOfParts and HeadingPairs when a slide is added', async () => {
			context.zip.file('docProps/app.xml', APP_XML_WITH_TITLES);

			const slides = [
				makeTitleSlide('Intro', 1),
				makeTitleSlide('Body', 2),
				makeTitleSlide('Conclusion', 3),
			];
			await updater.updateOnSave(slides);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
			const props = parsed['Properties'] as Record<string, unknown>;

			expect(String(props['Slides'])).toBe('3');
			// Slide-titles heading count follows the slide count.
			expect(readSlideTitleCount(props)).toBe(3);

			const { size, entries } = readTitlesOfParts(props);
			// 1 theme entry + 3 slide titles.
			expect(size).toBe('4');
			expect(entries).toStrictEqual(['Office Theme', 'Intro', 'Body', 'Conclusion']);
			// Stale titles are gone.
			expect(entries).not.toContain('Old Slide 1');
			expect(entries).not.toContain('Old Slide 2');
		});

		it('recomputes counts when a slide is removed', async () => {
			context.zip.file('docProps/app.xml', APP_XML_WITH_TITLES);

			await updater.updateOnSave([makeTitleSlide('Only Slide', 1)]);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
			const props = parsed['Properties'] as Record<string, unknown>;

			expect(String(props['Slides'])).toBe('1');
			expect(readSlideTitleCount(props)).toBe(1);
			const { size, entries } = readTitlesOfParts(props);
			expect(size).toBe('2');
			expect(entries).toStrictEqual(['Office Theme', 'Only Slide']);
		});

		it('reflects retitled slides while preserving non-slide categories', async () => {
			context.zip.file('docProps/app.xml', APP_XML_WITH_TITLES);

			await updater.updateOnSave([makeTitleSlide('Renamed 1', 1), makeTitleSlide('Renamed 2', 2)]);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
			const props = parsed['Properties'] as Record<string, unknown>;

			const { entries } = readTitlesOfParts(props);
			expect(entries).toStrictEqual(['Office Theme', 'Renamed 1', 'Renamed 2']);
			// The preserved Theme category keeps count 1.
			expect(readSlideTitleCount(props)).toBe(2);
		});

		it('emits an empty title entry for a slide without a title placeholder', async () => {
			context.zip.file('docProps/app.xml', APP_XML_WITH_TITLES);

			await updater.updateOnSave([makeTitleSlide('Has Title', 1), makeSlide({ slideNumber: 2 })]);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
			const props = parsed['Properties'] as Record<string, unknown>;

			const { entries } = readTitlesOfParts(props);
			expect(entries).toStrictEqual(['Office Theme', 'Has Title', '']);
			expect(readSlideTitleCount(props)).toBe(2);
		});

		it('leaves app.xml untouched when HeadingPairs is absent', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			await updater.updateOnSave([makeTitleSlide('A', 1), makeTitleSlide('B', 2)]);

			const updatedXml = await context.zip.file('docProps/app.xml')!.async('string');
			expect(updatedXml).not.toContain('TitlesOfParts');
			expect(updatedXml).not.toContain('HeadingPairs');
			// Slide count is still corrected.
			const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
			const props = parsed['Properties'] as Record<string, unknown>;
			expect(String(props['Slides'])).toBe('2');
		});
	});

	// ── updateOnSave: custom properties ───────────────────────────────

	describe('updateOnSave — custom properties', () => {
		it('writes custom properties to custom.xml', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			await updater.updateOnSave([makeSlide()], {
				customProperties: [
					{ name: 'ProjectId', value: '12345', type: 'lpwstr' },
					{ name: 'Version', value: '2', type: 'i4' },
				],
			});

			const customXml = await context.zip.file('docProps/custom.xml')!.async('string');
			expect(customXml).toContain('ProjectId');
			expect(customXml).toContain('12345');
			expect(customXml).toContain('Version');
		});

		it('removes custom.xml when custom properties list is empty', async () => {
			context.zip.file('docProps/custom.xml', '<old/>');
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			await updater.updateOnSave([makeSlide()], {
				customProperties: [],
			});

			expect(context.zip.file('docProps/custom.xml')).toBeNull();
		});

		it('filters out properties with empty names', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			await updater.updateOnSave([makeSlide()], {
				customProperties: [
					{ name: '', value: 'ignored', type: 'lpwstr' },
					{ name: '  ', value: 'also ignored', type: 'lpwstr' },
				],
			});

			// Should remove custom.xml since no valid properties remain
			expect(context.zip.file('docProps/custom.xml')).toBeNull();
		});

		it('normalizes unknown custom property types to lpwstr', async () => {
			const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
			context.zip.file('docProps/app.xml', appXml);

			await updater.updateOnSave([makeSlide()], {
				customProperties: [{ name: 'Prop1', value: 'val', type: 'unknownType' }],
			});

			const customXml = await context.zip.file('docProps/custom.xml')!.async('string');
			expect(customXml).toContain('lpwstr');
		});
	});
});
