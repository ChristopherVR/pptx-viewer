/**
 * Tests for OLE renderer pure helpers.
 *
 * All assertions target functions exported from `ole-renderer-helpers.ts`
 * (the Angular-free layer). This avoids loading `@angular/common` / the JIT
 * compiler, which is not available in the plain vitest environment;
 * component/TestBed tests are a follow-up with @analogjs/vite-plugin-angular.
 *
 * The test suite mirrors the React `ole-element.test.ts` and the Vue
 * `OleRenderer.test.ts` where practical, so the three ports share the same
 * behavioural contract.
 */
import type { OlePptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildOleActionModel,
	buildOleInfoRows,
	formatBytes,
	getOleAriaLabel,
	getOleBadgeLabel,
	getOleDisplayName,
	getOleDownloadFileName,
	getOleTypeColor,
	getOleTypeLabel,
	getPlaceholderStyle,
	isBrowserOpenableMime,
	resolveOleType,
} from './ole-renderer-helpers';
import type { ResolvedOleType } from './ole-renderer-helpers';

// ==========================================================================
// Helpers
// ==========================================================================

function makeOle(overrides: Partial<OlePptxElement> = {}): OlePptxElement {
	return {
		id: 'ole_test',
		type: 'ole',
		x: 0,
		y: 0,
		width: 400,
		height: 300,
		...overrides,
	};
}

const ALL_TYPES: ResolvedOleType[] = ['excel', 'word', 'pdf', 'visio', 'mathtype', 'unknown'];

// ==========================================================================
// resolveOleType
// ==========================================================================

describe('resolveOleType', () => {
	it("returns 'excel' when oleObjectType is 'excel'", () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'excel' }))).toBe('excel');
	});

	it("returns 'word' when oleObjectType is 'word'", () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'word' }))).toBe('word');
	});

	it("returns 'pdf' when oleObjectType is 'pdf'", () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'pdf' }))).toBe('pdf');
	});

	it("returns 'visio' when oleObjectType is 'visio'", () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'visio' }))).toBe('visio');
	});

	it("returns 'mathtype' when oleObjectType is 'mathtype'", () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'mathtype' }))).toBe('mathtype');
	});

	it("falls back to progId when oleObjectType is 'package'", () => {
		expect(resolveOleType(makeOle({ oleObjectType: 'package', oleProgId: 'Excel.Sheet.12' }))).toBe(
			'excel',
		);
	});

	it("falls back to progId when oleObjectType is 'unknown'", () => {
		expect(
			resolveOleType(makeOle({ oleObjectType: 'unknown', oleProgId: 'Word.Document.12' })),
		).toBe('word');
	});

	it('detects Excel from progId', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'Excel.Sheet.12' }))).toBe('excel');
	});

	it('detects Word from progId', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'Word.Document.8' }))).toBe('word');
	});

	it('detects PDF from AcroExch progId', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'AcroExch.Document' }))).toBe('pdf');
	});

	it('detects PDF from Acrobat progId', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'Acrobat.Document' }))).toBe('pdf');
	});

	it('detects Visio from progId', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'Visio.Drawing.11' }))).toBe('visio');
	});

	it('detects MathType from Equation progId', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'Equation.3' }))).toBe('mathtype');
	});

	it('detects MathType from MathType progId', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'MathType' }))).toBe('mathtype');
	});

	it("returns 'unknown' when no type information exists", () => {
		expect(resolveOleType(makeOle({}))).toBe('unknown');
	});

	it("returns 'unknown' for unrecognised progId", () => {
		expect(resolveOleType(makeOle({ oleProgId: 'SomethingRandom.App.1' }))).toBe('unknown');
	});

	it('is case-insensitive for progId matching', () => {
		expect(resolveOleType(makeOle({ oleProgId: 'EXCEL.Sheet.12' }))).toBe('excel');
	});
});

// ==========================================================================
// getOleTypeColor
// ==========================================================================

describe('getOleTypeColor', () => {
	it('returns green for excel', () => {
		expect(getOleTypeColor('excel')).toBe('#217346');
	});

	it('returns blue for word', () => {
		expect(getOleTypeColor('word')).toBe('#2B579A');
	});

	it('returns red for pdf', () => {
		expect(getOleTypeColor('pdf')).toBe('#D4272E');
	});

	it('returns blue for visio', () => {
		expect(getOleTypeColor('visio')).toBe('#3955A3');
	});

	it('returns purple for mathtype', () => {
		expect(getOleTypeColor('mathtype')).toBe('#7B2D8E');
	});

	it('returns grey for unknown', () => {
		expect(getOleTypeColor('unknown')).toBe('#666666');
	});

	it('returns a valid 6-digit hex colour for every type', () => {
		for (const t of ALL_TYPES) {
			expect(getOleTypeColor(t)).toMatch(/^#[0-9A-Fa-f]{6}$/u);
		}
	});
});

// ==========================================================================
// getOleTypeLabel
// ==========================================================================

describe('getOleTypeLabel', () => {
	it("returns 'Excel Spreadsheet' for excel", () => {
		expect(getOleTypeLabel('excel')).toBe('Excel Spreadsheet');
	});

	it("returns 'Word Document' for word", () => {
		expect(getOleTypeLabel('word')).toBe('Word Document');
	});

	it("returns 'PDF Document' for pdf", () => {
		expect(getOleTypeLabel('pdf')).toBe('PDF Document');
	});

	it("returns 'Visio Diagram' for visio", () => {
		expect(getOleTypeLabel('visio')).toBe('Visio Diagram');
	});

	it("returns 'Math Equation' for mathtype", () => {
		expect(getOleTypeLabel('mathtype')).toBe('Math Equation');
	});

	it("returns 'Embedded Object' for unknown", () => {
		expect(getOleTypeLabel('unknown')).toBe('Embedded Object');
	});

	it('returns a non-empty string for every type', () => {
		for (const t of ALL_TYPES) {
			expect(getOleTypeLabel(t).length).toBeGreaterThan(0);
		}
	});
});

// ==========================================================================
// getOleBadgeLabel
// ==========================================================================

describe('getOleBadgeLabel', () => {
	it("returns 'OLE' for unknown type", () => {
		expect(getOleBadgeLabel('unknown')).toBe('OLE');
	});

	it("returns 'EXCEL' for excel", () => {
		expect(getOleBadgeLabel('excel')).toBe('EXCEL');
	});

	it("returns 'PDF' for pdf", () => {
		expect(getOleBadgeLabel('pdf')).toBe('PDF');
	});

	it("returns 'WORD' for word", () => {
		expect(getOleBadgeLabel('word')).toBe('WORD');
	});

	it("returns 'VISIO' for visio", () => {
		expect(getOleBadgeLabel('visio')).toBe('VISIO');
	});

	it("returns 'MATHTYPE' for mathtype", () => {
		expect(getOleBadgeLabel('mathtype')).toBe('MATHTYPE');
	});

	it('returns an upper-case string for every known type', () => {
		for (const t of ALL_TYPES) {
			const label = getOleBadgeLabel(t);
			expect(label).toBe(label.toUpperCase());
		}
	});
});

// ==========================================================================
// getOleAriaLabel
// ==========================================================================

describe('getOleAriaLabel', () => {
	it('includes filename when available', () => {
		expect(getOleAriaLabel(makeOle({ oleObjectType: 'excel', fileName: 'budget.xlsx' }))).toBe(
			'Excel Spreadsheet: budget.xlsx',
		);
	});

	it('uses type label when no file name is present', () => {
		expect(getOleAriaLabel(makeOle({ oleObjectType: 'word' }))).toBe('Word Document');
	});

	it('resolves type from progId when oleObjectType is not set', () => {
		expect(getOleAriaLabel(makeOle({ oleProgId: 'AcroExch.Document.11' }))).toBe('PDF Document');
	});

	it("returns 'Embedded Object' when nothing is known", () => {
		expect(getOleAriaLabel(makeOle({}))).toBe('Embedded Object');
	});

	it('includes filename with unknown type', () => {
		expect(getOleAriaLabel(makeOle({ fileName: 'data.bin' }))).toBe('Embedded Object: data.bin');
	});
});

// ==========================================================================
// getOleDisplayName
// ==========================================================================

describe('getOleDisplayName', () => {
	it('returns the file name when present', () => {
		expect(getOleDisplayName(makeOle({ oleObjectType: 'excel', fileName: 'budget.xlsx' }))).toBe(
			'budget.xlsx',
		);
	});

	it('falls back to the type label when fileName is absent', () => {
		expect(getOleDisplayName(makeOle({ oleObjectType: 'word' }))).toBe('Word Document');
	});

	it("uses 'Embedded Object' when type and file name are both unknown", () => {
		expect(getOleDisplayName(makeOle({}))).toBe('Embedded Object');
	});
});

// ==========================================================================
// getPlaceholderStyle
// ==========================================================================

describe('getPlaceholderStyle', () => {
	it('produces a style map with border, border-radius, and background-color', () => {
		const style = getPlaceholderStyle('excel');
		expect(style['border']).toBeDefined();
		expect(style['border-radius']).toBeDefined();
		expect(style['background-color']).toBeDefined();
	});

	it("incorporates the Excel brand colour '#217346' in the border", () => {
		const style = getPlaceholderStyle('excel');
		expect(style['border'] as string).toContain('#217346');
	});

	it('produces different colours for different types', () => {
		const excelBorder = getPlaceholderStyle('excel')['border'];
		const pdfBorder = getPlaceholderStyle('pdf')['border'];
		expect(excelBorder).not.toBe(pdfBorder);
	});

	it('returns a style for every resolved type', () => {
		for (const t of ALL_TYPES) {
			const style = getPlaceholderStyle(t);
			expect(Object.keys(style).length).toBeGreaterThan(0);
		}
	});
});

// ==========================================================================
// Consistency checks
// ==========================================================================

describe('oLE helper consistency', () => {
	it('colour, label, and badge are defined for all types', () => {
		for (const t of ALL_TYPES) {
			expect(getOleTypeColor(t)).toBeTruthy();
			expect(getOleTypeLabel(t)).toBeTruthy();
			expect(getOleBadgeLabel(t)).toBeTruthy();
		}
	});

	it('round-trip: oleObjectType → resolveOleType → getOleTypeLabel', () => {
		const known: Array<{
			oleObjectType: OlePptxElement['oleObjectType'];
			expected: ResolvedOleType;
		}> = [
			{ oleObjectType: 'excel', expected: 'excel' },
			{ oleObjectType: 'word', expected: 'word' },
			{ oleObjectType: 'pdf', expected: 'pdf' },
			{ oleObjectType: 'visio', expected: 'visio' },
			{ oleObjectType: 'mathtype', expected: 'mathtype' },
		];
		for (const { oleObjectType, expected } of known) {
			const el = makeOle({ oleObjectType });
			expect(resolveOleType(el)).toBe(expected);
			expect(getOleTypeLabel(expected).length).toBeGreaterThan(0);
		}
	});
});

// ==========================================================================
// getOleDownloadFileName
// ==========================================================================

describe('getOleDownloadFileName', () => {
	it('prefers the recovered embedded file name', () => {
		expect(
			getOleDownloadFileName(
				makeOle({ oleEmbeddedFileName: 'recovered.xlsx', fileName: 'authored.xlsx' }),
			),
		).toBe('recovered.xlsx');
	});

	it('falls back to the authored file name', () => {
		expect(getOleDownloadFileName(makeOle({ fileName: 'authored.xlsx' }))).toBe('authored.xlsx');
	});

	it('uses a generic fallback when no name is known', () => {
		expect(getOleDownloadFileName(makeOle({}))).toBe('embedded-object');
	});
});

// ==========================================================================
// buildOleInfoRows
// ==========================================================================

describe('buildOleInfoRows', () => {
	it('always includes a type row', () => {
		const rows = buildOleInfoRows(makeOle({ oleObjectType: 'excel' }));
		expect(rows[0]).toStrictEqual({ key: 'type', label: 'Type', value: 'Excel Spreadsheet' });
	});

	it('includes file, size, and application rows when known', () => {
		const rows = buildOleInfoRows(
			makeOle({
				oleObjectType: 'excel',
				oleEmbeddedFileName: 'budget.xlsx',
				oleEmbeddedByteSize: 2048,
				oleProgId: 'Excel.Sheet.12',
			}),
		);
		const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
		expect(byKey['file']).toBe('budget.xlsx');
		expect(byKey['size']).toBe('2 KB');
		expect(byKey['application']).toBe('Excel.Sheet.12');
	});

	it('prefers the embedded file name over the authored one', () => {
		const rows = buildOleInfoRows(
			makeOle({ oleEmbeddedFileName: 'recovered.bin', fileName: 'authored.bin' }),
		);
		const fileRow = rows.find((r) => r.key === 'file');
		expect(fileRow?.value).toBe('recovered.bin');
	});

	it('omits the file row when no file name is known', () => {
		const rows = buildOleInfoRows(makeOle({}));
		expect(rows.some((r) => r.key === 'file')).toBeFalsy();
	});

	it('omits the size row when byte size is absent', () => {
		const rows = buildOleInfoRows(makeOle({}));
		expect(rows.some((r) => r.key === 'size')).toBeFalsy();
	});

	it('omits the application row when no progId is present', () => {
		const rows = buildOleInfoRows(makeOle({}));
		expect(rows.some((r) => r.key === 'application')).toBeFalsy();
	});
});

// ==========================================================================
// buildOleActionModel
// ==========================================================================

describe('buildOleActionModel', () => {
	it('enables download when an embedded data-URL is present', () => {
		const model = buildOleActionModel(
			makeOle({
				oleObjectType: 'excel',
				oleEmbeddedData: 'data:application/octet-stream;base64,AAAA',
				oleEmbeddedFileName: 'budget.xlsx',
			}),
		);
		expect(model.canDownload).toBeTruthy();
		expect(model.downloadHref).toBe('data:application/octet-stream;base64,AAAA');
		expect(model.downloadFileName).toBe('budget.xlsx');
	});

	it('does not enable download when no embedded data is present', () => {
		const model = buildOleActionModel(makeOle({ oleObjectType: 'excel' }));
		expect(model.canDownload).toBeFalsy();
		expect(model.canOpen).toBeFalsy();
		expect(model.downloadHref).toBeUndefined();
	});

	it('treats an empty embedded data-URL as not downloadable', () => {
		const model = buildOleActionModel(makeOle({ oleEmbeddedData: '' }));
		expect(model.canDownload).toBeFalsy();
	});

	it('enables open for a browser-openable mime (PDF)', () => {
		const model = buildOleActionModel(
			makeOle({
				oleEmbeddedData: 'data:application/pdf;base64,AAAA',
				oleEmbeddedMimeType: 'application/pdf',
			}),
		);
		expect(model.canDownload).toBeTruthy();
		expect(model.canOpen).toBeTruthy();
	});

	it('does not enable open for a binary office mime', () => {
		const model = buildOleActionModel(
			makeOle({
				oleEmbeddedData: 'data:application/vnd...;base64,AAAA',
				oleEmbeddedMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			}),
		);
		expect(model.canDownload).toBeTruthy();
		expect(model.canOpen).toBeFalsy();
	});

	it('exposes a human-readable size label when known', () => {
		const model = buildOleActionModel(
			makeOle({ oleEmbeddedData: 'data:text/plain;base64,AAAA', oleEmbeddedByteSize: 1536 }),
		);
		expect(model.sizeLabel).toBe('1.5 KB');
	});

	it('carries the info rows', () => {
		const model = buildOleActionModel(makeOle({ oleObjectType: 'word' }));
		expect(model.info[0]?.value).toBe('Word Document');
	});
});

// ==========================================================================
// formatBytes
// ==========================================================================

describe('formatBytes', () => {
	it('returns undefined for undefined input', () => {
		expect(formatBytes(undefined)).toBeUndefined();
	});

	it('returns undefined for negative input', () => {
		expect(formatBytes(-1)).toBeUndefined();
	});

	it('returns undefined for non-finite input', () => {
		expect(formatBytes(Number.NaN)).toBeUndefined();
		expect(formatBytes(Number.POSITIVE_INFINITY)).toBeUndefined();
	});

	it('renders a singular byte', () => {
		expect(formatBytes(1)).toBe('1 byte');
	});

	it('renders whole bytes below 1 KB', () => {
		expect(formatBytes(0)).toBe('0 bytes');
		expect(formatBytes(512)).toBe('512 bytes');
	});

	it('renders KB with one decimal place, trimming a trailing .0', () => {
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(1536)).toBe('1.5 KB');
	});

	it('renders MB and GB', () => {
		expect(formatBytes(1024 * 1024)).toBe('1 MB');
		expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
	});
});

// ==========================================================================
// isBrowserOpenableMime
// ==========================================================================

describe('isBrowserOpenableMime', () => {
	it('returns false for undefined or empty', () => {
		expect(isBrowserOpenableMime(undefined)).toBeFalsy();
		expect(isBrowserOpenableMime('')).toBeFalsy();
	});

	it('opens PDF', () => {
		expect(isBrowserOpenableMime('application/pdf')).toBeTruthy();
	});

	it('opens any image type', () => {
		expect(isBrowserOpenableMime('image/png')).toBeTruthy();
		expect(isBrowserOpenableMime('image/svg+xml')).toBeTruthy();
	});

	it('opens any text type', () => {
		expect(isBrowserOpenableMime('text/plain')).toBeTruthy();
		expect(isBrowserOpenableMime('text/html')).toBeTruthy();
	});

	it('opens common application text formats', () => {
		expect(isBrowserOpenableMime('application/json')).toBeTruthy();
		expect(isBrowserOpenableMime('application/xml')).toBeTruthy();
	});

	it('does not open binary office formats', () => {
		expect(
			isBrowserOpenableMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
		).toBeFalsy();
		expect(isBrowserOpenableMime('application/octet-stream')).toBeFalsy();
	});

	it('is case-insensitive and ignores charset parameters', () => {
		expect(isBrowserOpenableMime('TEXT/Plain; charset=UTF-8')).toBeTruthy();
		expect(isBrowserOpenableMime('Application/PDF')).toBeTruthy();
	});
});
