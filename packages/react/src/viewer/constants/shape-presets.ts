/**
 * Shape presets with their icon definitions for the toolbar shape picker.
 *
 * The catalogue data (types, labels, i18n keys, glyph descriptors) lives in
 * `pptx-viewer-shared` (`render/shape-preset-catalog.ts`) so every binding
 * shares one copy; this module only maps the framework-neutral glyph names
 * onto the Lucide icon components React renders.
 *
 * NOTE: `label` keeps the English fallback text (existing consumers outside
 * this sweep still render `preset.label` directly). Each preset also carries
 * an `i18nKey` pointing at the shared i18n dictionary, matching the
 * `{ value, i18nKey }` convention already used elsewhere in this codebase, so
 * a render site can switch to `t(preset.i18nKey)` without a data-shape change.
 */

import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
import type { ShapePresetGlyph } from 'pptx-viewer-shared';
import React from 'react';
import {
	LuCircle,
	LuDatabase,
	LuDiamond,
	LuMinus,
	LuMoveRight,
	LuPlus,
	LuSquare,
	LuTriangle,
} from 'react-icons/lu';

import type { ShapePreset } from '../types';

const GLYPH_COMPONENTS: Record<ShapePresetGlyph, React.ElementType> = {
	square: LuSquare,
	circle: LuCircle,
	database: LuDatabase,
	diamond: LuDiamond,
	minus: LuMinus,
	moveRight: LuMoveRight,
	plus: LuPlus,
	triangle: LuTriangle,
};

export const SHAPE_PRESETS: (ShapePreset & { i18nKey: string })[] = SHAPE_PRESET_DEFS.map(
	(def) => ({
		type: def.type,
		label: def.label,
		i18nKey: def.i18nKey,
		icon: React.createElement(GLYPH_COMPONENTS[def.glyph], {
			className: def.glyphClass ? `w-3.5 h-3.5 ${def.glyphClass}` : 'w-3.5 h-3.5',
		}),
	}),
);
