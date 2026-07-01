/**
 * 3D-text (WordArt format-text-effects) inspector option lists: the OOXML bevel
 * preset catalogue and the surface-material preset catalogue, each with display
 * labels. Framework-free pure data, consumed by every binding's Text 3D
 * properties panel (React / Vue / Angular).
 */
import type { BevelPresetType, MaterialPresetType } from 'pptx-viewer-core';

export const BEVEL_PRESETS: ReadonlyArray<{ value: BevelPresetType; label: string }> = [
	{ value: 'none', label: 'None' },
	{ value: 'circle', label: 'Circle' },
	{ value: 'relaxedInset', label: 'Relaxed Inset' },
	{ value: 'cross', label: 'Cross' },
	{ value: 'coolSlant', label: 'Cool Slant' },
	{ value: 'angle', label: 'Angle' },
	{ value: 'softRound', label: 'Soft Round' },
	{ value: 'convex', label: 'Convex' },
	{ value: 'slope', label: 'Slope' },
	{ value: 'divot', label: 'Divot' },
	{ value: 'riblet', label: 'Riblet' },
	{ value: 'hardEdge', label: 'Hard Edge' },
	{ value: 'artDeco', label: 'Art Deco' },
];

export const MATERIAL_PRESETS: ReadonlyArray<{
	value: MaterialPresetType | '';
	label: string;
}> = [
	{ value: '', label: 'None' },
	{ value: 'matte', label: 'Matte' },
	{ value: 'warmMatte', label: 'Warm Matte' },
	{ value: 'plastic', label: 'Plastic' },
	{ value: 'metal', label: 'Metal' },
	{ value: 'dkEdge', label: 'Dark Edge' },
	{ value: 'softEdge', label: 'Soft Edge' },
	{ value: 'flat', label: 'Flat' },
	{ value: 'softmetal', label: 'Soft Metal' },
	{ value: 'clear', label: 'Clear' },
	{ value: 'powder', label: 'Powder' },
	{ value: 'translucentPowder', label: 'Translucent Powder' },
];
