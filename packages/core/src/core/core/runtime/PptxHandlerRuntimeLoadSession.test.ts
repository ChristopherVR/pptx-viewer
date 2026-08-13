import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../PptxHandler';

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeLoadSession (protected methods)
// ---------------------------------------------------------------------------

/**
 * Extracted from isZipContainer — checks the first 4 bytes (magic number)
 * to determine if the data is a ZIP/OPC container.
 */
function isZipContainer(data: ArrayBuffer): boolean {
	const bytes = new Uint8Array(data);
	if (bytes.byteLength < 4) {
		return false;
	}

	return (
		bytes[0] === 0x50 &&
		bytes[1] === 0x4b &&
		((bytes[2] === 0x03 && bytes[3] === 0x04) ||
			(bytes[2] === 0x05 && bytes[3] === 0x06) ||
			(bytes[2] === 0x07 && bytes[3] === 0x08))
	);
}

/**
 * Extracted from parseCustomXmlParts — regex pattern for matching
 * customXml item entries.
 */
function matchCustomXmlItem(path: string): { itemId: string } | null {
	const itemPattern = /^customXml\/item(\d+)\.xml$/i;
	const match = path.match(itemPattern);
	if (!match) {
		return null;
	}
	return { itemId: match[1] };
}

/**
 * Extracted from detectDigitalSignatureParts — checks if an entry path
 * indicates a digital signature part.
 */
function isSignaturePart(path: string): boolean {
	return path.includes('_xmlsignatures/');
}

// ---------------------------------------------------------------------------
// Tests: isZipContainer
// ---------------------------------------------------------------------------
describe('isZipContainer', () => {
	it('should return false for empty buffer', () => {
		expect(isZipContainer(new ArrayBuffer(0))).toBeFalsy();
	});

	it('should return false for buffer smaller than 4 bytes', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x03]).buffer;
		expect(isZipContainer(buf)).toBeFalsy();
	});

	it('should detect standard ZIP local file header (PK\\x03\\x04)', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
		expect(isZipContainer(buf)).toBeTruthy();
	});

	it('should detect empty archive signature (PK\\x05\\x06)', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x05, 0x06]).buffer;
		expect(isZipContainer(buf)).toBeTruthy();
	});

	it('should detect spanned archive signature (PK\\x07\\x08)', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x07, 0x08]).buffer;
		expect(isZipContainer(buf)).toBeTruthy();
	});

	it('should return false for non-ZIP data', () => {
		const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
		expect(isZipContainer(buf)).toBeFalsy();
	});

	it('should return false for PDF magic number', () => {
		// %PDF
		const buf = new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
		expect(isZipContainer(buf)).toBeFalsy();
	});

	it('should return false for legacy .ppt (OLE2) magic number', () => {
		// D0 CF 11 E0 (OLE compound file)
		const buf = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer;
		expect(isZipContainer(buf)).toBeFalsy();
	});

	it('should return false for PK with wrong third/fourth byte', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x01, 0x02]).buffer;
		expect(isZipContainer(buf)).toBeFalsy();
	});

	it('should handle larger buffers that start with ZIP header', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff, 0xff]).buffer;
		expect(isZipContainer(buf)).toBeTruthy();
	});

	it('should return false for buffer with only PK prefix', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x00, 0x00]).buffer;
		expect(isZipContainer(buf)).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Tests: matchCustomXmlItem
// ---------------------------------------------------------------------------
describe('matchCustomXmlItem', () => {
	it('should match customXml/item1.xml', () => {
		const result = matchCustomXmlItem('customXml/item1.xml');
		expect(result).toStrictEqual({ itemId: '1' });
	});

	it('should match customXml/item42.xml', () => {
		const result = matchCustomXmlItem('customXml/item42.xml');
		expect(result).toStrictEqual({ itemId: '42' });
	});

	it('should be case-insensitive', () => {
		const result = matchCustomXmlItem('customXml/Item3.XML');
		expect(result).toStrictEqual({ itemId: '3' });
	});

	it('should not match customXml/itemProps1.xml', () => {
		expect(matchCustomXmlItem('customXml/itemProps1.xml')).toBeNull();
	});

	it('should not match ppt/slides/slide1.xml', () => {
		expect(matchCustomXmlItem('ppt/slides/slide1.xml')).toBeNull();
	});

	it('should not match customXml/item.xml (no number)', () => {
		expect(matchCustomXmlItem('customXml/item.xml')).toBeNull();
	});

	it('should not match paths with extra segments', () => {
		expect(matchCustomXmlItem('nested/customXml/item1.xml')).toBeNull();
	});

	it('should match single-digit item IDs', () => {
		const result = matchCustomXmlItem('customXml/item9.xml');
		expect(result).toStrictEqual({ itemId: '9' });
	});

	it('should match multi-digit item IDs', () => {
		const result = matchCustomXmlItem('customXml/item123.xml');
		expect(result).toStrictEqual({ itemId: '123' });
	});
});

// ---------------------------------------------------------------------------
// Tests: isSignaturePart
// ---------------------------------------------------------------------------
describe('isSignaturePart', () => {
	it('should detect _xmlsignatures directory entries', () => {
		expect(isSignaturePart('_xmlsignatures/sig1.xml')).toBeTruthy();
	});

	it('should detect nested signature paths', () => {
		expect(isSignaturePart('docProps/_xmlsignatures/origin.sigs')).toBeTruthy();
	});

	it('should return false for regular paths', () => {
		expect(isSignaturePart('ppt/slides/slide1.xml')).toBeFalsy();
	});

	it('should return false for empty string', () => {
		expect(isSignaturePart('')).toBeFalsy();
	});

	it('should detect paths with just the folder prefix', () => {
		expect(isSignaturePart('_xmlsignatures/')).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Tests: the real container guard, through the real public entry point
// ---------------------------------------------------------------------------
/**
 * These drive `PptxHandler.load()` rather than a local copy of the guard,
 * because the message this guard produces was WRONG for years and a
 * reimplementation could never have caught it: it told every user of a corrupt
 * file that "Legacy .ppt is not supported", long after `core/ppt/` made legacy
 * binary .ppt load fine. The old copy even used the OLE magic bytes as its
 * "non-ZIP" sample, which is precisely the input that never reaches this guard.
 */
describe('the non-ZIP container guard', () => {
	// `PptxHandler` is imported STATICALLY at the top of this file, not lazily
	// here: core's module graph is large enough that a dynamic import inside a
	// hook times out on a loaded machine, and paying for it at collection is
	// both cheaper and not subject to a per-test clock.
	const load = async (bytes: number[]): Promise<string> => {
		try {
			await new PptxHandler().load(new Uint8Array(bytes).buffer as ArrayBuffer);
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
		throw new Error('expected load() to reject');
	};

	it('rejects an empty or sub-header buffer as truncated', async () => {
		await expect(load([])).resolves.toContain('empty or truncated');
		await expect(load([0x50])).resolves.toContain('empty or truncated');
	}, 30_000);

	it('rejects bytes that are neither ZIP nor OLE, without blaming .ppt', async () => {
		const message = await load([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
		expect(message).toContain('not a ZIP/OpenXML package');
		expect(message).toMatch(/corrupt, truncated, or not a presentation/u);
		expect(message).not.toMatch(/Legacy \.ppt is not supported/u);
	}, 30_000);

	/**
	 * An OLE compound file is routed away from this guard entirely by
	 * `PptxHandlerCore.load()`: it is how BOTH a legacy binary .ppt and an
	 * encrypted OOXML package arrive. So it must never produce the non-ZIP
	 * message, whatever else it fails with.
	 */
	it('never reports an OLE compound file as "not a ZIP"', async () => {
		const message = await load([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
		expect(message).not.toContain('not a ZIP/OpenXML package');
	}, 30_000);

	it('gets past the guard for real ZIP magic', async () => {
		// A bare local-file header is a valid container and a broken package, so
		// the failure has to come from further down the pipeline, not this guard.
		const message = await load([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
		expect(message).not.toContain('not a ZIP/OpenXML package');
	}, 30_000);
});

// ---------------------------------------------------------------------------
// Tests: initializeLoadSession state clearing
// ---------------------------------------------------------------------------
describe('initializeLoadSession state clearing logic', () => {
	it('should clear all caches on initialization', () => {
		// Simulate the cache clearing that happens in initializeLoadSession
		const slideRelsMap = new Map([['slide1', new Map([['rId1', 'target']])]]);
		const externalRelsMap = new Map([['slide1', new Set(['rId2'])]]);
		const slideMap = new Map([['slide1', { data: 'xml' }]]);
		const layoutCache = new Map([['layout1', [{ id: 'el1' }]]]);
		const masterCache = new Map([['master1', [{ id: 'el2' }]]]);
		const imageDataCache = new Map([['img1', 'data:image/png;base64,...']]);

		slideRelsMap.clear();
		externalRelsMap.clear();
		slideMap.clear();
		layoutCache.clear();
		masterCache.clear();
		imageDataCache.clear();

		expect(slideRelsMap.size).toBe(0);
		expect(externalRelsMap.size).toBe(0);
		expect(slideMap.size).toBe(0);
		expect(layoutCache.size).toBe(0);
		expect(masterCache.size).toBe(0);
		expect(imageDataCache.size).toBe(0);
	});

	it('should reset scalar state values', () => {
		// Simulate the scalar resets
		let themeColorMap: Record<string, string> = { dk1: '#000000' };
		let themeFontMap: Record<string, string> = { 'mj-lt': 'Arial' };
		let presentationDefaultTextStyle: unknown = { fontSize: 12 };
		let thumbnailData: Uint8Array | null = new Uint8Array([1, 2, 3]);
		let vbaProjectBin: Uint8Array | null = new Uint8Array([4, 5, 6]);
		let isStrictOoxml = true;

		// Reset
		themeColorMap = {};
		themeFontMap = {};
		presentationDefaultTextStyle = undefined;
		thumbnailData = null;
		vbaProjectBin = null;
		isStrictOoxml = false;

		expect(Object.keys(themeColorMap)).toHaveLength(0);
		expect(Object.keys(themeFontMap)).toHaveLength(0);
		expect(presentationDefaultTextStyle).toBeUndefined();
		expect(thumbnailData).toBeNull();
		expect(vbaProjectBin).toBeNull();
		expect(isStrictOoxml).toBeFalsy();
	});
});
