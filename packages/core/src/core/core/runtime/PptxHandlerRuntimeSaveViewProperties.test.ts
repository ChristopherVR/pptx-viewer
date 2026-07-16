/**
 * Tests for the viewProps and tableStyles save writers.
 *
 * The runtime methods (`applyViewPropertiesPart`, `applyTableStylesPart`)
 * are protected and depend on the full mixin chain, so we exercise them
 * by instantiating the concrete `PptxHandlerRuntime` and casting to a
 * structural type that exposes the protected methods. The pure helpers
 * are imported and tested directly.
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeEach } from 'vitest';

import type { XmlObject, PptxViewProperties, ParsedTableStyleMap } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';
import { applyTableStyleEntryToNode } from './PptxHandlerRuntimeSaveViewProperties';

interface RuntimeWithProtected {
	zip: JSZip;
	parser: { parse(xml: string): XmlObject };
	builder: { build(obj: XmlObject): string };
	applyViewPropertiesPart(props: PptxViewProperties | undefined): Promise<void>;
	applyTableStylesPart(styles: ParsedTableStyleMap | undefined): Promise<void>;
}

function createRuntime(): RuntimeWithProtected {
	return new PptxHandlerRuntime() as unknown as RuntimeWithProtected;
}

const PRESENTATION_RELS_DEFAULT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
</Relationships>`;

describe('applyViewPropertiesPart', () => {
	let runtime: RuntimeWithProtected;

	beforeEach(() => {
		runtime = createRuntime();
	});

	it('serialises typed view properties back to ppt/viewProps.xml', async () => {
		runtime.zip.file('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS_DEFAULT);
		runtime.zip.file(
			'ppt/viewProps.xml',
			`<?xml version="1.0"?><p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
		);

		await runtime.applyViewPropertiesPart({
			lastView: 'sldView',
			showComments: true,
			normalViewPr: { showOutlineIcons: true, snapVertSplitter: false },
			slideViewPr: {
				snapToGrid: true,
				snapToObjects: false,
				showGuides: true,
				scale: { n: 75, d: 100 },
			},
		});

		const written = await runtime.zip.file('ppt/viewProps.xml')?.async('string');
		expect(written).toBeDefined();
		expect(written).toContain('lastView="sldView"');
		expect(written).toContain('showComments="1"');
		expect(written).toContain('snapToGrid="1"');
		expect(written).toContain('showGuides="1"');
		expect(written).toContain('<a:sx');
		expect(written).toMatch(/n="75"/);
		expect(written).toMatch(/d="100"/);
	});

	it('is a no-op when the source archive has no viewProps part', async () => {
		runtime.zip.file('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS_DEFAULT);
		// No viewProps.xml in the zip.

		await runtime.applyViewPropertiesPart({
			lastView: 'sldView',
		});

		expect(runtime.zip.file('ppt/viewProps.xml')).toBeNull();
	});

	it('is a no-op when properties are undefined', async () => {
		runtime.zip.file('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS_DEFAULT);
		const original = `<?xml version="1.0"?><p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" lastView="notesView"/>`;
		runtime.zip.file('ppt/viewProps.xml', original);

		await runtime.applyViewPropertiesPart(undefined);

		const after = await runtime.zip.file('ppt/viewProps.xml')?.async('string');
		expect(after).toBe(original);
	});

	it('preserves rawXml when present so unmodelled fields round-trip', async () => {
		runtime.zip.file('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS_DEFAULT);
		runtime.zip.file(
			'ppt/viewProps.xml',
			`<?xml version="1.0"?><p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`,
		);

		const rawXml: XmlObject = {
			'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			'@_lastView': 'sldView',
			'p:gridSpacing': { '@_cx': '76200', '@_cy': '76200' },
		};

		await runtime.applyViewPropertiesPart({
			lastView: 'notesView',
			rawXml,
		});

		const written = await runtime.zip.file('ppt/viewProps.xml')?.async('string');
		expect(written).toContain('lastView="notesView"');
		// Raw-only field still emitted.
		expect(written).toContain('p:gridSpacing');
		expect(written).toContain('cx="76200"');
	});

	it('writes dirty view geometry while preserving nested extensions', async () => {
		runtime.zip.file('ppt/_rels/presentation.xml.rels', PRESENTATION_RELS_DEFAULT);
		runtime.zip.file(
			'ppt/viewProps.xml',
			`<?xml version="1.0"?><p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>`,
		);
		const rawXml: XmlObject = {
			'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
			'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
			'p:slideViewPr': {
				'p:cSldViewPr': {
					'p:cViewPr': { 'p:extLst': { 'p:ext': { '@_uri': 'keep' } } },
				},
			},
		};

		await runtime.applyViewPropertiesPart({
			rawXml,
			slideViewPr: {
				origin: { x: -10, y: 20 },
				scale: { n: 3, d: 4, sy: { n: 2, d: 3 } },
			},
			gridSpacing: { cx: 76200, cy: 38100 },
		});

		const written = await runtime.zip.file('ppt/viewProps.xml')?.async('string');
		expect(written).toContain('<p:cViewPr>');
		expect(written).toContain('<a:sy n="2" d="3"');
		expect(written).toContain('<p:origin x="-10" y="20"');
		expect(written).toContain('<p:gridSpacing cx="76200" cy="38100"');
		expect(written).toContain('uri="keep"');
	});
});

describe('applyTableStylesPart', () => {
	let runtime: RuntimeWithProtected;

	beforeEach(() => {
		runtime = createRuntime();
	});

	const SOURCE_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}">
	<a:tblStyle styleId="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}" styleName="Medium Style 2 - Accent 1">
		<a:wholeTbl>
			<a:tcStyle>
				<a:fill>
					<a:solidFill>
						<a:schemeClr val="accent1">
							<a:tint val="20000"/>
						</a:schemeClr>
					</a:solidFill>
				</a:fill>
			</a:tcStyle>
		</a:wholeTbl>
	</a:tblStyle>
</a:tblStyleLst>`;

	it('merges edits onto existing styles and preserves the def GUID', async () => {
		runtime.zip.file('ppt/tableStyles.xml', SOURCE_STYLES);

		const styles: ParsedTableStyleMap = {
			'{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': {
				styleId: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}',
				styleName: 'Renamed Style',
				wholeTblFill: { schemeColor: 'accent2', tint: 40000 },
				firstRowText: { bold: true, fontSchemeColor: 'lt1' },
			},
		};

		await runtime.applyTableStylesPart(styles);

		const written = await runtime.zip.file('ppt/tableStyles.xml')?.async('string');
		expect(written).toBeDefined();
		// def GUID preserved verbatim.
		expect(written).toContain('def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"');
		// Style renamed.
		expect(written).toContain('styleName="Renamed Style"');
		// Edited fill replaces old scheme/tint.
		expect(written).toContain('val="accent2"');
		expect(written).toMatch(/<a:tint[^>]*val="40000"/);
		// New text style emitted under firstRow.
		expect(written).toContain('a:firstRow');
		expect(written).toContain('a:tcTxStyle');
		expect(written).toContain('b="on"');
	});

	it('round-trips parsed styles unchanged on no-op merge', async () => {
		runtime.zip.file('ppt/tableStyles.xml', SOURCE_STYLES);

		const styles: ParsedTableStyleMap = {
			'{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': {
				styleId: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}',
				wholeTblFill: { schemeColor: 'accent1', tint: 20000 },
			},
		};

		await runtime.applyTableStylesPart(styles);

		const written = await runtime.zip.file('ppt/tableStyles.xml')?.async('string');
		expect(written).toContain('def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"');
		expect(written).toContain('val="accent1"');
		expect(written).toMatch(/<a:tint[^>]*val="20000"/);
	});

	it('is a no-op when the source archive has no tableStyles part', async () => {
		await runtime.applyTableStylesPart({
			'{ABC}': {
				styleId: '{ABC}',
				wholeTblFill: { schemeColor: 'accent1' },
			},
		});

		expect(runtime.zip.file('ppt/tableStyles.xml')).toBeNull();
	});

	it('is a no-op when no styles passed via options', async () => {
		runtime.zip.file('ppt/tableStyles.xml', SOURCE_STYLES);

		await runtime.applyTableStylesPart(undefined);

		const after = await runtime.zip.file('ppt/tableStyles.xml')?.async('string');
		expect(after).toBe(SOURCE_STYLES);

		await runtime.applyTableStylesPart({});
		const after2 = await runtime.zip.file('ppt/tableStyles.xml')?.async('string');
		expect(after2).toBe(SOURCE_STYLES);
	});

	it('normalises GUIDs without braces or in lowercase', async () => {
		runtime.zip.file('ppt/tableStyles.xml', SOURCE_STYLES);

		await runtime.applyTableStylesPart({
			'5c22544a-7ee6-4342-b048-85bdc9fd1c3a': {
				styleId: '5c22544a-7ee6-4342-b048-85bdc9fd1c3a',
				wholeTblFill: { schemeColor: 'accent3' },
			},
		});

		const written = await runtime.zip.file('ppt/tableStyles.xml')?.async('string');
		expect(written).toContain('val="accent3"');
	});
});

describe('applyTableStyleEntryToNode (pure)', () => {
	it('inserts new sections when missing on the style node', () => {
		const node: XmlObject = { '@_styleId': '{X}' };
		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			firstRowFill: { schemeColor: 'accent1', shade: 50000 },
			firstRowText: { italic: true },
		});

		const firstRow = node['a:firstRow'] as XmlObject;
		expect(firstRow).toBeDefined();
		const schemeClr = firstRow['a:tcStyle']?.['a:fill']?.['a:solidFill']?.['a:schemeClr'] as
			| XmlObject
			| undefined;
		expect(schemeClr?.['@_val']).toBe('accent1');
		expect(schemeClr?.['a:shade']?.['@_val']).toBe('50000');
		expect(firstRow['a:tcTxStyle']?.['@_i']).toBe('on');
	});

	it('does not overwrite sections that have no edits', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:wholeTbl': {
				'a:tcStyle': {
					'a:fill': {
						'a:solidFill': { 'a:schemeClr': { '@_val': 'accent5' } },
					},
				},
			},
		};

		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			firstRowFill: { schemeColor: 'accent1' },
		});

		const wholeTbl = node['a:wholeTbl'] as XmlObject;
		expect(
			(wholeTbl['a:tcStyle'] as XmlObject)['a:fill']?.['a:solidFill']?.['a:schemeClr']?.['@_val'],
		).toBe('accent5');
	});

	it('replaces existing colour choice on a fill (solidFill is a choice)', () => {
		const node: XmlObject = {
			'@_styleId': '{X}',
			'a:wholeTbl': {
				'a:tcStyle': {
					'a:fill': {
						'a:solidFill': {
							'a:srgbClr': { '@_val': 'FF0000' },
						},
					},
				},
			},
		};

		applyTableStyleEntryToNode(node, {
			styleId: '{X}',
			wholeTblFill: { schemeColor: 'accent2', tint: 25000 },
		});

		const solidFill = (node['a:wholeTbl'] as XmlObject)['a:tcStyle']?.['a:fill']?.[
			'a:solidFill'
		] as XmlObject;
		expect(solidFill['a:srgbClr']).toBeUndefined();
		expect(solidFill['a:schemeClr']?.['@_val']).toBe('accent2');
		expect(solidFill['a:schemeClr']?.['a:tint']?.['@_val']).toBe('25000');
	});
});
