import type { PptxTableData } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildTableRows } from './table-view';

describe('table cell borders', () => {
	it('draws no border on a side the deck gives none, and keeps a border it gives', () => {
		const data: PptxTableData = {
			columnWidths: [0.5, 0.5],
			rows: [
				{
					cells: [
						{ text: 'plain' },
						{ text: 'ruled', style: { borderLeftWidth: 2, borderLeftColor: '#ff0000' } },
					],
				},
			],
		};
		const [plain, ruled] = buildTableRows(data)[0]?.cells ?? [];
		// No default 1px white border: it would push the cell content in.
		expect(plain?.style).not.toMatch(/border/u);
		expect(ruled?.style).toMatch(/border-left:\s*2px solid #ff0000/u);
		expect(ruled?.style).not.toMatch(/border-right/u);
	});
});
