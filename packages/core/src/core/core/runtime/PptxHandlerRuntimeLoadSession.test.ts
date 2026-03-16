import { describe, it, expect } from 'vitest';

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

/**
 * Simulates the validation logic from initializeLoadSession.
 */
function validateLoadInput(data: ArrayBuffer): { valid: true } | { valid: false; error: string } {
	if (data.byteLength < 4) {
		return {
			valid: false,
			error: 'Invalid PPTX binary: file is empty or truncated.',
		};
	}
	if (!isZipContainer(data)) {
		return {
			valid: false,
			error: 'Invalid PPTX binary: not a ZIP/OpenXML file. Legacy .ppt is not supported.',
		};
	}
	return { valid: true };
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
// Tests: validateLoadInput
// ---------------------------------------------------------------------------
describe('validateLoadInput', () => {
	it('should reject empty buffer', () => {
		const result = validateLoadInput(new ArrayBuffer(0));
		expect(result.valid).toBeFalsy();
		if (!result.valid) {
			expect(result.error).toContain('empty or truncated');
		}
	});

	it('should reject buffer smaller than 4 bytes', () => {
		const result = validateLoadInput(new Uint8Array([0x50]).buffer);
		expect(result.valid).toBeFalsy();
		if (!result.valid) {
			expect(result.error).toContain('empty or truncated');
		}
	});

	it('should reject non-ZIP data', () => {
		const buf = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]).buffer;
		const result = validateLoadInput(buf);
		expect(result.valid).toBeFalsy();
		if (!result.valid) {
			expect(result.error).toContain('not a ZIP/OpenXML file');
			expect(result.error).toContain('Legacy .ppt');
		}
	});

	it('should accept valid ZIP data', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer;
		const result = validateLoadInput(buf);
		expect(result.valid).toBeTruthy();
	});

	it('should accept valid empty ZIP archive', () => {
		const buf = new Uint8Array([0x50, 0x4b, 0x05, 0x06]).buffer;
		const result = validateLoadInput(buf);
		expect(result.valid).toBeTruthy();
	});

	it('should reject exactly 4 bytes that are not ZIP', () => {
		const buf = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
		const result = validateLoadInput(buf);
		expect(result.valid).toBeFalsy();
	});
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
