/**
 * Table style resolver: computes effective cell styles by layering the 12-part
 * OOXML table style cascade.
 *
 * Priority (lowest to highest):
 *   wholeTbl → band1H/band2H → band1V/band2V → lastRow → firstRow →
 *   lastCol → firstCol → corner cells (seCell, swCell, neCell, nwCell)
 *
 * @module table-style-resolver
 */

import type { PptxTableCellStyle } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Fill descriptor for a single table style part. */
export interface TableStylePartFill {
	/** Solid colour hex (e.g. "#FF0000"). */
	color?: string;
	/** Gradient fill definition (opaque — passed through to the renderer). */
	gradient?: unknown;
	/** Pattern fill definition (opaque — passed through to the renderer). */
	pattern?: unknown;
}

/** Per-edge border descriptor. */
export interface TableStylePartBorder {
	width?: number;
	color?: string;
	dash?: string;
}

/** Border set for a single table style part. */
export interface TableStylePartBorders {
	top?: TableStylePartBorder;
	bottom?: TableStylePartBorder;
	left?: TableStylePartBorder;
	right?: TableStylePartBorder;
}

/** Text formatting for a single table style part. */
export interface TableStylePartText {
	bold?: boolean;
	italic?: boolean;
	color?: string;
	fontSize?: number;
}

/**
 * Parsed visual data for one of the 12 table style sections.
 *
 * All fields are optional — only set properties participate in the cascade.
 */
export interface ParsedTableStylePart {
	fill?: TableStylePartFill;
	borders?: TableStylePartBorders;
	text?: TableStylePartText;
}

/**
 * Complete parsed table style with all 12 optional parts.
 */
export interface ParsedTableStyle {
	wholeTbl?: ParsedTableStylePart;
	band1H?: ParsedTableStylePart;
	band2H?: ParsedTableStylePart;
	band1V?: ParsedTableStylePart;
	band2V?: ParsedTableStylePart;
	firstRow?: ParsedTableStylePart;
	lastRow?: ParsedTableStylePart;
	firstCol?: ParsedTableStylePart;
	lastCol?: ParsedTableStylePart;
	seCell?: ParsedTableStylePart;
	swCell?: ParsedTableStylePart;
	neCell?: ParsedTableStylePart;
	nwCell?: ParsedTableStylePart;
}

/**
 * Boolean flags on the table that control which style parts are active.
 */
export interface TableStyleFlags {
	bandedRows?: boolean;
	bandedColumns?: boolean;
	firstRow?: boolean;
	lastRow?: boolean;
	firstCol?: boolean;
	lastCol?: boolean;
	/** Number of rows per band group (default 1). */
	bandRowCycle?: number;
	/** Number of columns per band group (default 1). */
	bandColCycle?: number;
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

/**
 * Deep-merge two `TableStylePartBorder` values.  `override` wins for each
 * individual property that is set.
 */
function mergeBorder(
	base: TableStylePartBorder | undefined,
	override: TableStylePartBorder | undefined,
): TableStylePartBorder | undefined {
	if (!base && !override) {
		return undefined;
	}
	if (!base) {
		return override;
	}
	if (!override) {
		return base;
	}
	return {
		width: override.width ?? base.width,
		color: override.color ?? base.color,
		dash: override.dash ?? base.dash,
	};
}

/**
 * Deep-merge two `ParsedTableStylePart` objects.  Properties from `override`
 * win when set; unset properties fall through to `base`.
 */
export function mergeStyleParts(
	base: ParsedTableStylePart | undefined,
	override: ParsedTableStylePart | undefined,
): ParsedTableStylePart | undefined {
	if (!base && !override) {
		return undefined;
	}
	if (!base) {
		return override;
	}
	if (!override) {
		return base;
	}

	const merged: ParsedTableStylePart = {};

	// Fill — override replaces the whole fill if any field is set.
	if (override.fill || base.fill) {
		merged.fill = {
			color: override.fill?.color ?? base.fill?.color,
			gradient: override.fill?.gradient ?? base.fill?.gradient,
			pattern: override.fill?.pattern ?? base.fill?.pattern,
		};
	}

	// Borders — per-edge merge.
	if (override.borders || base.borders) {
		merged.borders = {
			top: mergeBorder(base.borders?.top, override.borders?.top),
			bottom: mergeBorder(base.borders?.bottom, override.borders?.bottom),
			left: mergeBorder(base.borders?.left, override.borders?.left),
			right: mergeBorder(base.borders?.right, override.borders?.right),
		};
	}

	// Text — per-property merge.
	if (override.text || base.text) {
		merged.text = {
			bold: override.text?.bold ?? base.text?.bold,
			italic: override.text?.italic ?? base.text?.italic,
			color: override.text?.color ?? base.text?.color,
			fontSize: override.text?.fontSize ?? base.text?.fontSize,
		};
	}

	return merged;
}

// ---------------------------------------------------------------------------
// Cascade resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the effective style for a specific table cell by applying the full
 * 12-part OOXML table style cascade.
 *
 * Layer priority (lowest → highest):
 *   1. wholeTbl
 *   2. band1H / band2H  (horizontal banding)
 *   3. band1V / band2V  (vertical banding)
 *   4. lastRow
 *   5. firstRow
 *   6. lastCol
 *   7. firstCol
 *   8. corner cells (seCell, swCell, neCell, nwCell)
 *
 * @param rowIndex   Zero-based row index of the cell.
 * @param colIndex   Zero-based column index of the cell.
 * @param totalRows  Total number of rows in the table.
 * @param totalCols  Total number of columns in the table.
 * @param flags      Boolean table flags controlling which parts are active.
 * @param style      The parsed table style with up to 12 parts.
 * @returns Partial cell style with effective values from the cascade.
 */
export function resolveTableCellStyle(
	rowIndex: number,
	colIndex: number,
	totalRows: number,
	totalCols: number,
	flags: TableStyleFlags,
	style: ParsedTableStyle,
): Partial<PptxTableCellStyle> {
	// Start with wholeTbl as the base layer.
	let effective: ParsedTableStylePart | undefined = style.wholeTbl
		? { ...style.wholeTbl }
		: undefined;

	// ---- Horizontal banding (band1H / band2H) ----
	if (flags.bandedRows) {
		const cycle = flags.bandRowCycle ?? 1;
		// When firstRow is active the header row is excluded from banding.
		const bandRow = flags.firstRow ? rowIndex - 1 : rowIndex;
		// Only apply bands to data rows (bandRow >= 0).
		if (bandRow >= 0) {
			const bandIndex = Math.floor(bandRow / cycle) % 2;
			const bandPart = bandIndex === 0 ? style.band1H : style.band2H;
			if (bandPart) {
				effective = mergeStyleParts(effective, bandPart);
			}
		}
	}

	// ---- Vertical banding (band1V / band2V) ----
	if (flags.bandedColumns) {
		const cycle = flags.bandColCycle ?? 1;
		// When firstCol is active, the first column is excluded from banding.
		const bandCol = flags.firstCol ? colIndex - 1 : colIndex;
		if (bandCol >= 0) {
			const bandIndex = Math.floor(bandCol / cycle) % 2;
			const bandPart = bandIndex === 0 ? style.band1V : style.band2V;
			if (bandPart) {
				effective = mergeStyleParts(effective, bandPart);
			}
		}
	}

	// ---- Last row ----
	if (flags.lastRow && rowIndex === totalRows - 1 && style.lastRow) {
		effective = mergeStyleParts(effective, style.lastRow);
	}

	// ---- First row ----
	if (flags.firstRow && rowIndex === 0 && style.firstRow) {
		effective = mergeStyleParts(effective, style.firstRow);
	}

	// ---- Last column ----
	if (flags.lastCol && colIndex === totalCols - 1 && style.lastCol) {
		effective = mergeStyleParts(effective, style.lastCol);
	}

	// ---- First column ----
	if (flags.firstCol && colIndex === 0 && style.firstCol) {
		effective = mergeStyleParts(effective, style.firstCol);
	}

	// ---- Corner cells ----
	const isFirstRow = flags.firstRow && rowIndex === 0;
	const isLastRow = flags.lastRow && rowIndex === totalRows - 1;
	const isFirstCol = flags.firstCol && colIndex === 0;
	const isLastCol = flags.lastCol && colIndex === totalCols - 1;

	if (isLastRow && isLastCol && style.seCell) {
		effective = mergeStyleParts(effective, style.seCell);
	}
	if (isLastRow && isFirstCol && style.swCell) {
		effective = mergeStyleParts(effective, style.swCell);
	}
	if (isFirstRow && isLastCol && style.neCell) {
		effective = mergeStyleParts(effective, style.neCell);
	}
	if (isFirstRow && isFirstCol && style.nwCell) {
		effective = mergeStyleParts(effective, style.nwCell);
	}

	// ---- Convert merged ParsedTableStylePart → Partial<PptxTableCellStyle> ----
	return partToCellStyle(effective);
}

// ---------------------------------------------------------------------------
// Conversion helper
// ---------------------------------------------------------------------------

/**
 * Convert a merged `ParsedTableStylePart` into the `PptxTableCellStyle` shape
 * used by the renderer.
 */
function partToCellStyle(part: ParsedTableStylePart | undefined): Partial<PptxTableCellStyle> {
	if (!part) {
		return {};
	}

	const result: Partial<PptxTableCellStyle> = {};

	// Fill
	if (part.fill) {
		if (part.fill.color) {
			result.backgroundColor = part.fill.color;
			result.fillMode = 'solid';
		}
		if (part.fill.gradient) {
			result.fillMode = 'gradient';
		}
		if (part.fill.pattern) {
			result.fillMode = 'pattern';
		}
	}

	// Borders
	if (part.borders) {
		if (part.borders.top) {
			if (part.borders.top.width !== undefined) {
				result.borderTopWidth = part.borders.top.width;
			}
			if (part.borders.top.color) {
				result.borderTopColor = part.borders.top.color;
			}
			if (part.borders.top.dash) {
				result.borderTopDash = part.borders.top.dash;
			}
		}
		if (part.borders.bottom) {
			if (part.borders.bottom.width !== undefined) {
				result.borderBottomWidth = part.borders.bottom.width;
			}
			if (part.borders.bottom.color) {
				result.borderBottomColor = part.borders.bottom.color;
			}
			if (part.borders.bottom.dash) {
				result.borderBottomDash = part.borders.bottom.dash;
			}
		}
		if (part.borders.left) {
			if (part.borders.left.width !== undefined) {
				result.borderLeftWidth = part.borders.left.width;
			}
			if (part.borders.left.color) {
				result.borderLeftColor = part.borders.left.color;
			}
			if (part.borders.left.dash) {
				result.borderLeftDash = part.borders.left.dash;
			}
		}
		if (part.borders.right) {
			if (part.borders.right.width !== undefined) {
				result.borderRightWidth = part.borders.right.width;
			}
			if (part.borders.right.color) {
				result.borderRightColor = part.borders.right.color;
			}
			if (part.borders.right.dash) {
				result.borderRightDash = part.borders.right.dash;
			}
		}
	}

	// Text
	if (part.text) {
		if (part.text.bold !== undefined) {
			result.bold = part.text.bold;
		}
		if (part.text.italic !== undefined) {
			result.italic = part.text.italic;
		}
		if (part.text.color) {
			result.color = part.text.color;
		}
		if (part.text.fontSize !== undefined) {
			result.fontSize = part.text.fontSize;
		}
	}

	return result;
}
