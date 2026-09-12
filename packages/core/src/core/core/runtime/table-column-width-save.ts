import type { XmlObject } from '../../types';
import { xmlChild, xmlChildren } from '../../utils/xml-access';

/** Update an existing grid in place, retaining its total extent and column metadata. */
export function writeTableColumnWidths(tbl: XmlObject, columnWidths: readonly number[]): void {
	const columns = xmlChildren(xmlChild(tbl, 'a:tblGrid'), 'a:gridCol');
	if (!columns.length || columns.length !== columnWidths.length) {
		return;
	}
	const existingWidths = columns.map((column) => {
		const value = column['@_w'];
		return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
			? Number(value)
			: NaN;
	});
	if (existingWidths.some((width) => !Number.isSafeInteger(width) || width < 0)) {
		return;
	}
	const totalWidth = existingWidths.reduce((sum, width) => sum + width, 0);
	if (!Number.isSafeInteger(totalWidth) || totalWidth <= 0) {
		return;
	}
	if (columnWidths.some((width) => !Number.isFinite(width) || width < 0)) {
		return;
	}
	// The model contains proportions, not arbitrary weights. Do not invent a
	// normalization policy for invalid input; permit floating-point sum error.
	const sum = columnWidths.reduce((total, width) => total + width, 0);
	if (Math.abs(sum - 1) > Number.EPSILON * columnWidths.length * 4) {
		return;
	}

	// Round boundaries rather than each width independently so repeated saves
	// do not grow or shrink the grid by rounding individual column extents.
	let cumulative = 0;
	let previousBoundary = 0;
	for (let index = 0; index < columns.length; index++) {
		cumulative += columnWidths[index];
		const boundary =
			index === columns.length - 1
				? totalWidth
				: Math.min(totalWidth, Math.round(cumulative * totalWidth));
		const width = boundary - previousBoundary;
		if (width !== existingWidths[index]) {
			columns[index]['@_w'] = String(width);
		}
		previousBoundary = boundary;
	}
}
