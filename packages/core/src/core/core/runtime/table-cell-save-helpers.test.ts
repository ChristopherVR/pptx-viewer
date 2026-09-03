import { describe, it, expect } from 'vitest';

import type { XmlObject, PptxTableCellStyle } from '../../types';
import {
	writeCellFill,
	writeDiagonalBorders,
	writeCellTextFormatting,
} from './table-cell-save-helpers';

const EMU_PER_PX = 9525;

function ensureArray(val: unknown): XmlObject[] {
	if (!val) {
		return [];
	}
	const arr = Array.isArray(val) ? val : [val];
	return arr as XmlObject[];
}

describe('writeDiagonalBorders', () => {
	it('should serialize diagonal down border (a:lnTlToBr)', () => {
		const tcPr: XmlObject = {};
		const style: PptxTableCellStyle = {
			borderDiagDownWidth: 2,
			borderDiagDownColor: '#FF0000',
		};
		writeDiagonalBorders(tcPr, style, EMU_PER_PX);

		const diagDown = tcPr['a:lnTlToBr'] as XmlObject;
		expect(diagDown).toBeDefined();
		expect(diagDown['@_w']).toBe(String(Math.round(2 * EMU_PER_PX)));
		expect((diagDown['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual({
			'@_val': 'FF0000',
		});
	});

	it('should serialize diagonal up border (a:lnBlToTr)', () => {
		const tcPr: XmlObject = {};
		const style: PptxTableCellStyle = {
			borderDiagUpWidth: 3,
			borderDiagUpColor: '#00FF00',
		};
		writeDiagonalBorders(tcPr, style, EMU_PER_PX);

		const diagUp = tcPr['a:lnBlToTr'] as XmlObject;
		expect(diagUp).toBeDefined();
		expect(diagUp['@_w']).toBe(String(Math.round(3 * EMU_PER_PX)));
		expect((diagUp['a:solidFill'] as XmlObject)['a:srgbClr']).toStrictEqual({
			'@_val': '00FF00',
		});
	});

	it('should serialize both diagonal borders', () => {
		const tcPr: XmlObject = {};
		const style: PptxTableCellStyle = {
			borderDiagDownWidth: 1,
			borderDiagDownColor: '#AA0000',
			borderDiagUpWidth: 2,
			borderDiagUpColor: '#00AA00',
		};
		writeDiagonalBorders(tcPr, style, EMU_PER_PX);

		expect(tcPr['a:lnTlToBr']).toBeDefined();
		expect(tcPr['a:lnBlToTr']).toBeDefined();
	});

	it('should not create border nodes when no diagonal styles', () => {
		const tcPr: XmlObject = {};
		writeDiagonalBorders(tcPr, {}, EMU_PER_PX);
		expect(tcPr['a:lnTlToBr']).toBeUndefined();
		expect(tcPr['a:lnBlToTr']).toBeUndefined();
	});

	it('should strip hash from color values', () => {
		const tcPr: XmlObject = {};
		writeDiagonalBorders(
			tcPr,
			{ borderDiagDownColor: '#AABBCC', borderDiagDownWidth: 1 },
			EMU_PER_PX,
		);
		const fill = (tcPr['a:lnTlToBr'] as XmlObject)['a:solidFill'] as XmlObject;
		expect((fill['a:srgbClr'] as XmlObject)['@_val']).toBe('AABBCC');
	});
});

describe('writeCellTextFormatting', () => {
	it('should write bold/italic/underline/fontSize/color to all runs', () => {
		const xmlCell: XmlObject = {
			'a:txBody': {
				'a:p': [
					{
						'a:r': [
							{ 'a:rPr': {}, 'a:t': 'Hello' },
							{ 'a:rPr': {}, 'a:t': ' World' },
						],
					},
					{
						'a:r': { 'a:rPr': {}, 'a:t': 'Second para' },
					},
				],
			},
		};

		const style: PptxTableCellStyle = {
			bold: true,
			italic: true,
			underline: true,
			fontSize: 14,
			color: '#0000FF',
		};

		writeCellTextFormatting(xmlCell, style, ensureArray);

		const paragraphs = ensureArray(xmlCell['a:txBody']?.['a:p']);
		expect(paragraphs).toHaveLength(2);

		// First paragraph, first run
		const firstRuns = ensureArray(paragraphs[0]['a:r']);
		expect(firstRuns).toHaveLength(2);
		for (const run of firstRuns) {
			const rPr = run['a:rPr'] as XmlObject;
			expect(rPr['@_b']).toBe('1');
			expect(rPr['@_i']).toBe('1');
			expect(rPr['@_u']).toBe('sng');
			expect(rPr['@_sz']).toBe('1400');
			expect(rPr['a:solidFill']).toStrictEqual({
				'a:srgbClr': { '@_val': '0000FF' },
			});
		}

		// Second paragraph
		const secondRun = ensureArray(paragraphs[1]['a:r'])[0];
		const rPr = secondRun['a:rPr'] as XmlObject;
		expect(rPr['@_b']).toBe('1');
	});

	it('rounds fractional point sizes to valid OOXML hundredths', () => {
		const xmlCell: XmlObject = {
			'a:txBody': {
				'a:p': { 'a:r': { 'a:rPr': {}, 'a:t': 'Fractional size' } },
			},
		};

		writeCellTextFormatting(xmlCell, { fontSize: 10.555 }, ensureArray);

		const paragraph = ensureArray(xmlCell['a:txBody']?.['a:p'])[0];
		const run = ensureArray(paragraph['a:r'])[0];
		expect((run['a:rPr'] as XmlObject)['@_sz']).toBe('1056');
	});

	it('should create a:rPr if missing on runs', () => {
		const xmlCell: XmlObject = {
			'a:txBody': {
				'a:p': {
					'a:r': { 'a:t': 'No rPr' },
				},
			},
		};
		writeCellTextFormatting(xmlCell, { bold: true }, ensureArray);

		const run = ensureArray(ensureArray(xmlCell['a:txBody']?.['a:p'])[0]?.['a:r'])[0];
		expect((run['a:rPr'] as XmlObject)['@_b']).toBe('1');
	});

	it('should not modify runs when no text style properties', () => {
		const xmlCell: XmlObject = {
			'a:txBody': {
				'a:p': { 'a:r': { 'a:rPr': { '@_b': '0' }, 'a:t': 'Text' } },
			},
		};
		writeCellTextFormatting(xmlCell, {}, ensureArray);

		const run = ensureArray(ensureArray(xmlCell['a:txBody']?.['a:p'])[0]?.['a:r'])[0];
		expect((run['a:rPr'] as XmlObject)['@_b']).toBe('0');
	});

	it('should set bold=false correctly', () => {
		const xmlCell: XmlObject = {
			'a:txBody': {
				'a:p': { 'a:r': { 'a:rPr': { '@_b': '1' }, 'a:t': 'Bold' } },
			},
		};
		writeCellTextFormatting(xmlCell, { bold: false }, ensureArray);

		const run = ensureArray(ensureArray(xmlCell['a:txBody']?.['a:p'])[0]?.['a:r'])[0];
		expect((run['a:rPr'] as XmlObject)['@_b']).toBe('0');
	});
});

describe('writeCellFill', () => {
	it('should write solid fill', () => {
		const tcPr: XmlObject = {};
		writeCellFill(tcPr, { backgroundColor: '#112233' });
		expect(tcPr['a:solidFill']).toStrictEqual({
			'a:srgbClr': { '@_val': '112233' },
		});
	});

	it('should write no-fill mode', () => {
		const tcPr: XmlObject = {
			'a:solidFill': { 'a:srgbClr': { '@_val': 'AABBCC' } },
		};
		writeCellFill(tcPr, { fillMode: 'none' });
		expect(tcPr['a:solidFill']).toBeUndefined();
		expect(tcPr['a:gradFill']).toBeUndefined();
		expect(tcPr['a:pattFill']).toBeUndefined();
	});

	// A previously image-filled cell (`a:blipFill`) edited to a different fill
	// mode must not leave the stray `a:blipFill` behind: two mutually exclusive
	// fill children (e.g. `a:blipFill` + the newly-written `a:solidFill`) in the
	// same `a:tcPr` is schema-invalid OOXML.
	describe('a:blipFill cleanup', () => {
		function tcPrWithBlipFill(): XmlObject {
			return { 'a:blipFill': { 'a:blip': { '@_r:embed': 'rId3' } } };
		}

		it('removes a:blipFill when writing a solid fill', () => {
			const tcPr = tcPrWithBlipFill();
			writeCellFill(tcPr, { backgroundColor: '#112233' });
			expect(tcPr['a:blipFill']).toBeUndefined();
			expect(tcPr['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': '112233' } });
		});

		it('removes a:blipFill when writing a gradient fill', () => {
			const tcPr = tcPrWithBlipFill();
			writeCellFill(tcPr, {
				fillMode: 'gradient',
				gradientFillStops: [{ color: '#FF0000', position: 0 }],
			});
			expect(tcPr['a:blipFill']).toBeUndefined();
			expect(tcPr['a:gradFill']).toBeDefined();
		});

		it('removes a:blipFill when writing a pattern fill', () => {
			const tcPr = tcPrWithBlipFill();
			writeCellFill(tcPr, { fillMode: 'pattern', patternFillPreset: 'ltDnDiag' });
			expect(tcPr['a:blipFill']).toBeUndefined();
			expect(tcPr['a:pattFill']).toBeDefined();
		});

		it('removes a:blipFill when writing no-fill mode', () => {
			const tcPr = tcPrWithBlipFill();
			writeCellFill(tcPr, { fillMode: 'none' });
			expect(tcPr['a:blipFill']).toBeUndefined();
		});

		it('leaves a:blipFill untouched when the style is still an unedited image fill', () => {
			// No fill branch matches `fillMode: 'image'` (there is no authoring
			// path for it yet), so the original blipFill must survive a save
			// exactly as parsed.
			const tcPr = tcPrWithBlipFill();
			writeCellFill(tcPr, { fillMode: 'image', backgroundImageFillPath: 'ppt/media/image1.png' });
			expect(tcPr['a:blipFill']).toStrictEqual({ 'a:blip': { '@_r:embed': 'rId3' } });
		});

		it('does not write a spurious a:solidFill for an image fill carrying a fallback backgroundColor', () => {
			// Guards the `fillMode !== 'image'` check in the solid branch: without
			// it, a fallback `backgroundColor` on an image-filled cell would make
			// the solid branch fire and write `a:solidFill` alongside the
			// still-untouched `a:blipFill`, corrupting the XML on ANY save even
			// when the cell's fill was never edited.
			const tcPr = tcPrWithBlipFill();
			writeCellFill(tcPr, {
				fillMode: 'image',
				backgroundImageFillPath: 'ppt/media/image1.png',
				backgroundColor: '#808080',
			});
			expect(tcPr['a:solidFill']).toBeUndefined();
			expect(tcPr['a:blipFill']).toBeDefined();
		});
	});
});
