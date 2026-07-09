/**
 * Shape presets with their icon definitions for the toolbar shape picker.
 *
 * NOTE: `label` keeps the English fallback text (existing consumers outside
 * this sweep still render `preset.label` directly). Each preset also carries
 * an `i18nKey` pointing at the shared i18n dictionary, matching the
 * `{ value, i18nKey }` convention already used elsewhere in this codebase, so
 * a render site can switch to `t(preset.i18nKey)` without a data-shape change.
 */

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

const icon = (component: React.ElementType, className: string): React.ReactNode =>
	React.createElement(component, { className });

export const SHAPE_PRESETS: (ShapePreset & { i18nKey: string })[] = [
	{
		type: 'rect',
		label: 'Rectangle',
		i18nKey: 'pptx.editorToolbar.shapeRectangle',
		icon: icon(LuSquare, 'w-3.5 h-3.5'),
	},
	{
		type: 'roundRect',
		label: 'Rounded',
		i18nKey: 'pptx.shapePresets.rounded',
		icon: icon(LuSquare, 'w-3.5 h-3.5'),
	},
	{
		type: 'ellipse',
		label: 'Circle',
		i18nKey: 'pptx.shapePresets.circle',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'cylinder',
		label: 'Cylinder',
		i18nKey: 'pptx.shapePresets.cylinder',
		icon: icon(LuDatabase, 'w-3.5 h-3.5'),
	},
	{
		type: 'rtArrow',
		label: 'Right Arrow',
		i18nKey: 'pptx.shapePresets.rightArrow',
		icon: icon(LuMoveRight, 'w-3.5 h-3.5'),
	},
	{
		type: 'leftArrow',
		label: 'Left Arrow',
		i18nKey: 'pptx.shapePresets.leftArrow',
		icon: icon(LuMoveRight, 'w-3.5 h-3.5 rotate-180'),
	},
	{
		type: 'upArrow',
		label: 'Up Arrow',
		i18nKey: 'pptx.shapePresets.upArrow',
		icon: icon(LuMoveRight, 'w-3.5 h-3.5 -rotate-90'),
	},
	{
		type: 'downArrow',
		label: 'Down Arrow',
		i18nKey: 'pptx.shapePresets.downArrow',
		icon: icon(LuMoveRight, 'w-3.5 h-3.5 rotate-90'),
	},
	{
		type: 'triangle',
		label: 'Triangle',
		i18nKey: 'pptx.editorToolbar.shapeTriangle',
		icon: icon(LuTriangle, 'w-3.5 h-3.5'),
	},
	{
		type: 'rtTriangle',
		label: 'Right Triangle',
		i18nKey: 'pptx.shapePresets.rightTriangle',
		icon: icon(LuTriangle, 'w-3.5 h-3.5 rotate-90'),
	},
	{
		type: 'diamond',
		label: 'Diamond',
		i18nKey: 'pptx.shapePresets.diamond',
		icon: icon(LuDiamond, 'w-3.5 h-3.5'),
	},
	{
		type: 'parallelogram',
		label: 'Parallelogram',
		i18nKey: 'pptx.shapePresets.parallelogram',
		icon: icon(LuSquare, 'w-3.5 h-3.5 -skew-x-12'),
	},
	{
		type: 'trapezoid',
		label: 'Trapezoid',
		i18nKey: 'pptx.shapePresets.trapezoid',
		icon: icon(LuSquare, 'w-3.5 h-3.5'),
	},
	{
		type: 'pentagon',
		label: 'Pentagon',
		i18nKey: 'pptx.shapePresets.pentagon',
		icon: icon(LuDiamond, 'w-3.5 h-3.5'),
	},
	{
		type: 'hexagon',
		label: 'Hexagon',
		i18nKey: 'pptx.shapePresets.hexagon',
		icon: icon(LuDiamond, 'w-3.5 h-3.5'),
	},
	{
		type: 'octagon',
		label: 'Octagon',
		i18nKey: 'pptx.shapePresets.octagon',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'chevron',
		label: 'Chevron',
		i18nKey: 'pptx.shapePresets.chevron',
		icon: icon(LuMoveRight, 'w-3.5 h-3.5'),
	},
	{
		type: 'star5',
		label: 'Star',
		i18nKey: 'pptx.shapePresets.star',
		icon: icon(LuDiamond, 'w-3.5 h-3.5 rotate-45'),
	},
	{
		type: 'star6',
		label: 'Star 6',
		i18nKey: 'pptx.shapePresets.star6',
		icon: icon(LuDiamond, 'w-3.5 h-3.5'),
	},
	{
		type: 'star8',
		label: 'Star 8',
		i18nKey: 'pptx.shapePresets.star8',
		icon: icon(LuDiamond, 'w-3.5 h-3.5 rotate-45'),
	},
	{
		type: 'plus',
		label: 'Plus',
		i18nKey: 'pptx.shapePresets.plus',
		icon: icon(LuPlus, 'w-3.5 h-3.5'),
	},
	{
		type: 'heart',
		label: 'Heart',
		i18nKey: 'pptx.shapePresets.heart',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'cloud',
		label: 'Cloud',
		i18nKey: 'pptx.shapePresets.cloud',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'sun',
		label: 'Sun',
		i18nKey: 'pptx.shapePresets.sun',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'moon',
		label: 'Moon',
		i18nKey: 'pptx.shapePresets.moon',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'pie',
		label: 'Pie',
		i18nKey: 'pptx.shapePresets.pie',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'plaque',
		label: 'Plaque',
		i18nKey: 'pptx.shapePresets.plaque',
		icon: icon(LuSquare, 'w-3.5 h-3.5'),
	},
	{
		type: 'teardrop',
		label: 'Teardrop',
		i18nKey: 'pptx.shapePresets.teardrop',
		icon: icon(LuCircle, 'w-3.5 h-3.5'),
	},
	{
		type: 'line',
		label: 'Line',
		i18nKey: 'pptx.shapePresets.line',
		icon: icon(LuMinus, 'w-3.5 h-3.5'),
	},
	{
		type: 'connector',
		label: 'Connector',
		i18nKey: 'pptx.elementType.connector',
		icon: icon(LuMoveRight, 'w-3.5 h-3.5'),
	},
];
