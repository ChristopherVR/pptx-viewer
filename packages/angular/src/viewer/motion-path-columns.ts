/**
 * motion-path-columns.ts: the motion-path catalogue grouped into
 * PowerPoint's Lines / Arcs / Turns / Shapes / Loops families, for the
 * inspector's motion-path select. The ribbon gallery that used to share this
 * model now renders in the shared `pptx-ui-ribbon-animations` view.
 */
import {
	MOTION_PATH_FAMILIES,
	motionPathFamilyLabelKey,
	motionPathPresetLabelKey,
	motionPathPresetsByFamily,
} from '../internal/shared';
import type { MotionPathFamily } from '../internal/shared';

/** One entry: the catalogue path it applies plus the key naming it. */
export interface MotionPathEntry {
	id: string;
	labelKey: string;
}

/** One column: a family caption plus the paths filed under it. */
export interface MotionPathColumn {
	family: MotionPathFamily;
	labelKey: string;
	presets: readonly MotionPathEntry[];
}

/** The columns, in the shared catalogue's own order, built once at module load. */
export const MOTION_PATH_COLUMNS: readonly MotionPathColumn[] = MOTION_PATH_FAMILIES.map(
	(family) => ({
		family,
		labelKey: motionPathFamilyLabelKey(family),
		presets: motionPathPresetsByFamily(family).map((preset) => ({
			id: preset.id,
			labelKey: motionPathPresetLabelKey(preset.id),
		})),
	}),
);
