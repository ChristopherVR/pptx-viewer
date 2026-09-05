import type { PptxThemeColorRef } from 'pptx-viewer-core';
import React from 'react';

import { normalizeHexColor } from '../../utils';
import { DebouncedColorInput } from './DebouncedColorInput';
import { ThemeColorSwatchGrid } from './ThemeColorSwatchGrid';

// ---------------------------------------------------------------------------
// TableCellColorField
// ---------------------------------------------------------------------------

/**
 * A table cell colour field: the native colour input plus the deck's theme
 * colour grid, used for both the cell text colour (`color`/`colorRef`) and
 * the cell fill colour (`backgroundColor`/`backgroundColorRef`). Extracted
 * so `TableCellFormattingPanel` (already near the 300-LOC file budget) does
 * not have to duplicate this block for both fields.
 *
 * A theme swatch commits both the resolved hex and its `PptxThemeColorRef`;
 * the native picker always clears the ref, since a plain hex has no theme
 * identity for PowerPoint to reapply.
 */
export function TableCellColorField({
	label,
	prefix,
	value,
	fallback,
	selectedRef,
	disabled,
	onCommit,
}: {
	label: string;
	/** Unique key prefix for the theme grid's React list keys. */
	prefix: string;
	value: string | undefined;
	fallback: string;
	selectedRef: PptxThemeColorRef | undefined;
	disabled: boolean;
	/** Applies the picked colour; `ref` is set for a theme swatch, `undefined` otherwise. */
	onCommit: (hex: string, ref: PptxThemeColorRef | undefined) => void;
}): React.ReactElement {
	const hex = normalizeHexColor(value, fallback);
	return (
		<label className='flex flex-col gap-1'>
			<span className='text-muted-foreground'>{label}</span>
			<DebouncedColorInput
				disabled={disabled}
				value={hex}
				className='w-full h-7 rounded border border-border bg-transparent cursor-pointer'
				onCommit={(next) => onCommit(next, undefined)}
			/>
			<ThemeColorSwatchGrid
				prefix={prefix}
				disabled={disabled}
				selectedRef={selectedRef}
				selectedHex={hex}
				onPick={(c) => onCommit(c.hex, c.ref)}
			/>
		</label>
	);
}
