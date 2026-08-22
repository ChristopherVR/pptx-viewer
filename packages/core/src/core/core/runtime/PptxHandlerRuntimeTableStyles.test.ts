/**
 * Tests for `parseTableStyles`, focused on the whole-table-STYLE image
 * texture fill (`a:tcStyle/a:fill/a:blipFill`): `ppt/tableStyles.xml` is a
 * presentation-level part with no slide/rels context of its own, so its
 * relationships must be read from `ppt/_rels/tableStyles.xml.rels` before a
 * section's `a:blipFill` can resolve to a path (see
 * `buildTableStylesImageResolver`).
 */
import JSZip from 'jszip';
import { describe, it, expect, beforeEach } from 'vitest';

import type { ParsedTableStyleMap, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

interface RuntimeWithProtected {
	zip: JSZip;
	parser: { parse(xml: string): XmlObject };
	allowExternalImages: boolean;
	parseTableStyles(): Promise<ParsedTableStyleMap | undefined>;
}

function createRuntime(): RuntimeWithProtected {
	return new PptxHandlerRuntime() as unknown as RuntimeWithProtected;
}

const STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

function tableStylesXml(fillXml: string): string {
	return (
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
		`<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="${STYLE_ID}">` +
		`<a:tblStyle styleId="${STYLE_ID}" styleName="Custom">` +
		`<a:wholeTbl><a:tcStyle><a:fill>${fillXml}</a:fill></a:tcStyle></a:wholeTbl>` +
		'</a:tblStyle>' +
		'</a:tblStyleLst>'
	);
}

describe('parseTableStyles: whole-table-style image fill', () => {
	let runtime: RuntimeWithProtected;

	beforeEach(() => {
		runtime = createRuntime();
	});

	it('resolves a:blipFill via ppt/_rels/tableStyles.xml.rels to an archive path', async () => {
		runtime.zip.file(
			'ppt/tableStyles.xml',
			tableStylesXml(
				'<a:blipFill><a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></a:blipFill>',
			),
		);
		runtime.zip.file(
			'ppt/_rels/tableStyles.xml.rels',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
				`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
				`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/tableTexture.png"/>` +
				'</Relationships>',
		);

		const map = await runtime.parseTableStyles();
		expect(map?.[STYLE_ID]?.wholeTblFill?.image?.path).toBe('ppt/media/tableTexture.png');
	});

	it('gates an external image target on allowExternalImages', async () => {
		runtime.zip.file(
			'ppt/tableStyles.xml',
			tableStylesXml(
				'<a:blipFill><a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></a:blipFill>',
			),
		);
		runtime.zip.file(
			'ppt/_rels/tableStyles.xml.rels',
			`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
				`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
				`<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://example.com/tex.png" TargetMode="External"/>` +
				'</Relationships>',
		);

		runtime.allowExternalImages = false;
		const blocked = await runtime.parseTableStyles();
		expect(blocked?.[STYLE_ID]?.wholeTblFill).toBeUndefined();

		runtime.allowExternalImages = true;
		const allowed = await runtime.parseTableStyles();
		expect(allowed?.[STYLE_ID]?.wholeTblFill?.image?.path).toBe('https://example.com/tex.png');
	});

	it('is a no-op when the archive has no tableStyles rels part', async () => {
		runtime.zip.file(
			'ppt/tableStyles.xml',
			tableStylesXml(
				'<a:blipFill><a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/></a:blipFill>',
			),
		);
		// No ppt/_rels/tableStyles.xml.rels in the zip.

		const map = await runtime.parseTableStyles();
		// The style entry itself still parses (name, id); only the unresolvable
		// image fill is dropped, exactly like a scheme/text property with no
		// matching data would be.
		expect(map?.[STYLE_ID]?.styleName).toBe('Custom');
		expect(map?.[STYLE_ID]?.wholeTblFill).toBeUndefined();
	});

	it('still resolves a plain solid fill without any rels part present', async () => {
		runtime.zip.file(
			'ppt/tableStyles.xml',
			tableStylesXml('<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>'),
		);

		const map = await runtime.parseTableStyles();
		expect(map?.[STYLE_ID]?.wholeTblFill?.schemeColor).toBe('accent1');
	});
});
