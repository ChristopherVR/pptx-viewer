/**
 * The exact model field pair each colour-picker surface writes on a commit
 * ({@link ThemeColorPickerCommit}), named once so five bindings cannot each
 * spell `backgroundColorRef` / `colorRef` differently (or forget the ref
 * field entirely, which is how a swatch pick silently degraded to a plain
 * hex in the ribbon Shape Fill/Outline pickers before this module existed).
 *
 * Every helper here is a trivial field rename: the interesting decision
 * logic (which swatch is selected, what a click vs. a custom hex commits)
 * already lives in {@link ../render/theme-color-picker-state}. This module
 * only exists so that decision's OUTPUT lands on the right property names
 * for each surface (gradient stop, table cell fill, table cell text).
 *
 * @module render/theme-color-field-commit
 */
import type { PptxTableCellStyle } from 'pptx-viewer-core';

import type { GradientStop } from './gradient-picker';
import type { ThemeColorPickerCommit } from './theme-color-picker-state';

/**
 * The `color` / `colorRef` patch a gradient stop editor writes for one stop,
 * in any binding. Pass to `updateGradientStopPatch(el, index, ...)` or merge
 * directly into the stop object a binding's own gradient state holds.
 */
export function gradientStopColorCommitPatch(
	commit: ThemeColorPickerCommit,
): Pick<GradientStop, 'color' | 'colorRef'> {
	return { color: commit.hex, colorRef: commit.ref };
}

/**
 * The `backgroundColor` / `backgroundColorRef` patch a table cell fill
 * picker writes, mirroring `ShapeStyle.fillColorRef`'s "ref wins on save"
 * contract.
 */
export function tableCellFillColorCommitPatch(
	commit: ThemeColorPickerCommit,
): Pick<PptxTableCellStyle, 'backgroundColor' | 'backgroundColorRef'> {
	return { backgroundColor: commit.hex, backgroundColorRef: commit.ref };
}

/**
 * The `color` / `colorRef` patch a table cell text colour picker writes,
 * mirroring `TextStyle.colorRef`'s "ref wins on save" contract.
 */
export function tableCellTextColorCommitPatch(
	commit: ThemeColorPickerCommit,
): Pick<PptxTableCellStyle, 'color' | 'colorRef'> {
	return { color: commit.hex, colorRef: commit.ref };
}
