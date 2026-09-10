/**
 * Legacy `.ppt` OLE read-back integration test, against a real
 * PowerPoint-authored fixture (see `fixture-corpus-manifest.ts`'s
 * `ole-embed-excel.ppt` entry / `scripts/make-ole-embed-excel-fixture.ps1`):
 * a native embedded Excel.Sheet.8 worksheet, NOT this project's own
 * "Package"-wrapped writer output (that case is covered in
 * `packages/core/src/core/ppt/writer/ppt-writer-roundtrip.test.ts`).
 *
 * Proves `ole-embed-parser.ts` recovers the exact bytes real PowerPoint
 * wrote for a native OLE embed, not just this project's own round trip: the
 * recovered storage is fed back through `readOleXlsGrid` (the same reader
 * this project already uses for OLE-embedded Excel edit-in-place) and the
 * cell values are compared against what the fixture generator wrote via COM.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { OlePptxElement } from '../../core/types';
import { parseDataUrlToBytes } from '../../core/utils/data-url-utils';
import { readOleXlsGrid } from '../../core/utils/ole-sheet-xls-biff8';

const FIXTURE = path.resolve(__dirname, '../../../../../e2e/fixtures/ole-embed-excel.ppt');

function fixtureBuffer(): ArrayBuffer {
	const buf = readFileSync(FIXTURE);
	return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe('legacy .ppt OLE read-back: real PowerPoint-authored Excel.Sheet.8 embed', () => {
	it('recovers an editable ole element whose bytes match the embedded worksheet', async () => {
		const handler = new PptxHandler();
		const data = await handler.load(fixtureBuffer());
		expect(data.slides).toHaveLength(1);

		const oleEl = data.slides[0]!.elements.find((el): el is OlePptxElement => el.type === 'ole');
		expect(oleEl).toBeDefined();

		// The ExOleEmbedContainer's real ProgIDAtom ("Excel.Sheet.8"), not this
		// project's own writer's hardcoded "Package" marker.
		expect(oleEl!.oleProgId).toBe('Excel.Sheet.8');
		expect(oleEl!.oleObjectType).toBe('excel');

		expect(oleEl!.oleEmbeddedData).toBeTruthy();
		const recovered = parseDataUrlToBytes(oleEl!.oleEmbeddedData!);
		expect(recovered.bytes.length).toBeGreaterThan(0);

		const grid = readOleXlsGrid(recovered.bytes);
		expect(grid).toBeDefined();
		expect(grid!.rows[0]?.cells[0]?.value).toBe('Hello from Excel');
		// Value2=42 (an integer) is written as a BIFF RK/NUMBER record; the
		// grid reader stringifies whichever opcode PowerPoint chose.
		expect(Number(grid!.rows[0]?.cells[1]?.value)).toBe(42);
	});
});
