import { describe, expect, it } from 'vitest';

import type { PptxData, PptxSlide } from '../../core/types';
import { decodeJsonValue, encodeJsonValue } from './json-binary-codec';
import { PptxJsonFormatError, deserializePptxFromJson, parsePptxJson } from './json-deserializer';
import { decodePptxJsonText, isPptxJsonText, PPTX_JSON_FORMAT } from './json-document';
import { buildPptxJsonDocument, serializePptxToJson } from './json-serializer';
import { PptxJsonConverter, applyImportedPptxData } from './PptxJsonConverter';

const PNG_DATA_URL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function makeTestData(): PptxData {
	const slides: PptxSlide[] = [
		{
			id: 'ppt/slides/slide1.xml',
			slideNumber: 1,
			name: 'First',
			backgroundColor: '#FFFFFF',
			notes: 'presenter notes',
			transition: { type: 'fade', duration: 500 },
			elements: [
				{
					type: 'text',
					id: 'el-1',
					x: 10,
					y: 20,
					width: 300,
					height: 80,
					text: 'Hello JSON',
					textStyle: { fontSize: 24, bold: true },
				},
				{
					type: 'image',
					id: 'el-2',
					x: 50,
					y: 120,
					width: 200,
					height: 150,
					imageData: PNG_DATA_URL,
					altText: 'tiny png',
				},
			],
		},
		{
			id: 'ppt/slides/slide2.xml',
			slideNumber: 2,
			elements: [
				{
					type: 'shape',
					id: 'el-3',
					x: 0,
					y: 0,
					width: 100,
					height: 100,
					shapeType: 'rect',
					rawXml: { $weird: 'kept', $bytes: 'not-binary' },
				},
			],
		},
	] as unknown as PptxSlide[];

	return {
		slides,
		width: 960,
		height: 540,
		widthEmu: 12_192_000,
		heightEmu: 6_858_000,
		themeColorMap: { accent1: '#4472C4' },
		coreProperties: { title: 'Test deck', creator: 'vitest' },
		thumbnailData: new Uint8Array([1, 2, 3, 4, 5]),
		embeddedFonts: [
			{
				name: 'TestFont',
				dataUrl: 'data:font/truetype;base64,AAECAwQ=',
				rawFontData: new Uint8Array([9, 8, 7]),
			},
		],
	} as unknown as PptxData;
}

describe('pptx json converter', () => {
	it('round-trips a synthetic presentation with model equality', () => {
		const data = makeTestData();
		const json = serializePptxToJson(data);
		const rebuilt = deserializePptxFromJson(json);
		expect(rebuilt).toStrictEqual(data);
		// Byte fields must come back as real Uint8Array instances.
		expect(rebuilt.thumbnailData).toBeInstanceOf(Uint8Array);
		expect(rebuilt.embeddedFonts?.[0].rawFontData).toBeInstanceOf(Uint8Array);
	});

	it('writes the versioned envelope with slide count and asset accounting', () => {
		const doc = buildPptxJsonDocument(makeTestData(), { includeTimestamp: false });
		expect(doc.format).toBe(PPTX_JSON_FORMAT);
		expect(doc.version).toBe(1);
		expect(doc.slideCount).toBe(2);
		expect(doc.createdAt).toBeUndefined();
		// PNG data URL + font data URL + thumbnail bytes + raw font bytes.
		expect(doc.assets.count).toBe(4);
		expect(doc.assets.totalBytes).toBeGreaterThan(0);
	});

	it('supports the class facade for both directions', () => {
		const converter = new PptxJsonConverter({ generator: 'vitest', includeTimestamp: false });
		const doc = converter.toDocument(makeTestData());
		expect(doc.generator).toBe('vitest');
		const rebuilt = converter.fromJson(converter.toJson(makeTestData()));
		expect(rebuilt.slides).toHaveLength(2);
	});

	it('rejects non-JSON text', () => {
		expect(() => deserializePptxFromJson('PK not json')).toThrow(PptxJsonFormatError);
	});

	it('rejects JSON without the format marker', () => {
		expect(() => parsePptxJson('{"hello":"world"}')).toThrow(/format marker/);
	});

	it('rejects unsupported versions', () => {
		const doc = { format: PPTX_JSON_FORMAT, version: 99, presentation: {}, slides: [] };
		expect(() => parsePptxJson(JSON.stringify(doc))).toThrow(/Unsupported/);
	});

	it('rejects a slideCount that contradicts the slides array', () => {
		const doc = {
			format: PPTX_JSON_FORMAT,
			version: 1,
			slideCount: 5,
			presentation: { width: 960, height: 540 },
			slides: [],
		};
		expect(() => parsePptxJson(JSON.stringify(doc))).toThrow(/slideCount/);
	});

	it('rejects elements without a type discriminant', () => {
		const doc = {
			format: PPTX_JSON_FORMAT,
			version: 1,
			presentation: { width: 960, height: 540 },
			slides: [{ id: 's1', elements: [{ id: 'broken' }] }],
		};
		expect(() => parsePptxJson(JSON.stringify(doc))).toThrow(/"type" discriminant/);
	});

	it('sniffs JSON documents at text and byte level', () => {
		const json = serializePptxToJson(makeTestData());
		expect(isPptxJsonText(json)).toBeTruthy();
		expect(isPptxJsonText('  \n{"format":"pptx-viewer-json"}')).toBeTruthy();
		expect(isPptxJsonText('{"format":"other"}')).toBeFalsy();
		expect(isPptxJsonText('[1,2,3]')).toBeFalsy();

		const bytes = new TextEncoder().encode(json);
		expect(decodePptxJsonText(bytes)).toBe(json);
		// UTF-8 BOM + leading whitespace still sniffs.
		const withBom = new Uint8Array([0xef, 0xbb, 0xbf, 0x20, ...bytes]);
		expect(decodePptxJsonText(withBom)).not.toBeNull();
		// ZIP magic must never be treated as JSON.
		expect(decodePptxJsonText(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
		expect(decodePptxJsonText(new Uint8Array())).toBeNull();
	});

	it('escapes dollar-prefixed keys so tagged bytes cannot be spoofed', () => {
		const original = { $bytes: 'plain-string', $other: 1, nested: { $bytes: 'x' } };
		const encoded = encodeJsonValue(original) as Record<string, unknown>;
		expect(encoded.$$bytes).toBe('plain-string');
		const decoded = decodeJsonValue(JSON.parse(JSON.stringify(encoded)));
		expect(decoded).toStrictEqual(original);
	});

	it('overlays imported data onto a base presentation', () => {
		const base = {
			slides: [{ id: 'blank', elements: [] }],
			width: 960,
			height: 540,
			theme: { name: 'Office Theme' },
		} as unknown as PptxData;
		const imported = makeTestData();
		const merged = applyImportedPptxData(base, imported);
		expect(merged).toBe(base);
		expect(merged.slides).toHaveLength(2);
		expect(merged.themeColorMap).toStrictEqual({ accent1: '#4472C4' });
		// Fields absent from the import keep the base value.
		expect(merged.theme?.name).toBe('Office Theme');
	});
});
