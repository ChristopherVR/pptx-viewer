import type { PptxTableCell } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderTableCellContent } from './table-cell-runs';

/** Render the returned node tree to markup so span styles are assertable. */
function markup(cell: PptxTableCell | undefined, fallback: string): string {
	return renderToStaticMarkup(<div>{renderTableCellContent(cell, fallback)}</div>);
}

describe('renderTableCellContent', () => {
	it('falls back to the plain string when the cell carries no runs', () => {
		expect(markup({ text: 'plain' }, 'plain')).toBe('<div>plain</div>');
	});

	it('renders one styled span per run', () => {
		// React was the ONE binding with no per-run branch at all, so a cell
		// mixing formats rendered entirely in the first run's style.
		const cell: PptxTableCell = {
			text: 'Revenue grew 42%',
			textRuns: [
				{ text: 'Revenue ' },
				{ text: 'grew 42%', bold: true, color: '#C00000', fontSize: 18, fontFamily: 'Georgia' },
			],
		};
		const html = markup(cell, 'Revenue grew 42%');
		expect(html).toContain('Revenue ');
		expect(html).toContain('grew 42%');
		expect(html).toContain('font-weight:bold');
		expect(html).toContain('color:#C00000');
		expect(html).toContain('font-size:18pt');
		expect(html).toContain('font-family:Georgia');
	});

	it('renders a soft break as <br> and a paragraph boundary as a block div', () => {
		const cell: PptxTableCell = {
			text: 'a\nb',
			textRuns: [
				{ text: 'a' },
				{ text: '', isLineBreak: true },
				{ text: '', isParagraphBreak: true },
				{ text: 'b' },
			],
		};
		const html = markup(cell, 'a\nb');
		expect(html).toContain('<br/>');
		expect(html).toContain('display:block');
	});
});
