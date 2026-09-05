/**
 * `animation-emphasis-ground-truth-early` - emphasis ground-truth rows for
 * preset ids 1-19 (Change Fill Color through Object Color). Split out of
 * `animation-emphasis-ground-truth.ts` to keep that module under the repo's
 * file-size guideline; see that module's doc for the COM/UI-Automation
 * methodology, and `animation-emphasis-ground-truth.ts` for the composed
 * table this feeds.
 *
 * @module render/animation-emphasis-ground-truth-early
 */

import type { AnimationEmphasisGroundTruthRow } from './animation-emphasis-ground-truth-types';

export const ANIMATION_EMPHASIS_GROUND_TRUTH_EARLY: readonly AnimationEmphasisGroundTruthRow[] = [
	{
		presetId: 1,
		presetSubtype: 2,
		msoName: 'ChangeFillColor',
		ribbonName: 'Fill Color',
		attrNames: ['fillcolor', 'fill.type', 'fill.on'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 2,
		presetSubtype: 0,
		msoName: 'ChangeFont',
		attrNames: ['style.fontFamily'],
		children: ['set'],
	},
	{
		presetId: 3,
		presetSubtype: 2,
		msoName: 'ChangeFontColor',
		ribbonName: 'Font Color',
		attrNames: ['style.color'],
		children: ['animClr'],
	},
	{
		presetId: 4,
		presetSubtype: 2,
		msoName: 'ChangeFontSize',
		attrNames: ['style.fontSize'],
		children: ['anim'],
	},
	{
		presetId: 5,
		presetSubtype: 1,
		msoName: 'ChangeFontStyle',
		attrNames: ['style.fontStyle', 'style.fontWeight', 'style.textDecorationUnderline'],
		children: ['set'],
	},
	{
		presetId: 6,
		presetSubtype: 0,
		msoName: 'GrowShrink',
		ribbonName: 'Grow/Shrink',
		children: ['animScale'],
	},
	{
		presetId: 7,
		presetSubtype: 2,
		msoName: 'ChangeLineColor',
		ribbonName: 'Line Color',
		attrNames: ['stroke.color', 'stroke.on'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 8,
		presetSubtype: 0,
		msoName: 'Spin',
		ribbonName: 'Spin',
		attrNames: ['r'],
		children: ['animRot'],
	},
	{
		presetId: 9,
		presetSubtype: 0,
		msoName: 'Transparency',
		ribbonName: 'Transparency',
		filter: 'image',
		attrNames: ['style.opacity'],
		children: ['set'],
	},
	{
		presetId: 10,
		presetSubtype: 0,
		msoName: 'BoldFlash',
		ribbonName: 'Bold Flash',
		attrNames: ['style.fontWeight'],
		children: ['anim'],
	},
	{
		presetId: 14,
		presetSubtype: 0,
		msoName: 'Blast',
		attrNames: ['style.color', 'fillColor', 'fill.type', 'fill.on'],
		children: ['animClr', 'animScale', 'set'],
	},
	{
		presetId: 15,
		presetSubtype: 0,
		msoName: 'BoldReveal',
		ribbonName: 'Bold Reveal',
		attrNames: ['style.fontWeight'],
		children: ['set'],
	},
	{
		presetId: 16,
		presetSubtype: 0,
		msoName: 'BrushOnColor',
		ribbonName: 'Brush Color',
		attrNames: ['style.color', 'fillcolor', 'fill.type'],
		children: ['set'],
	},
	{
		presetId: 18,
		presetSubtype: 0,
		msoName: 'BrushOnUnderline',
		ribbonName: 'Underline',
		attrNames: ['style.textDecorationUnderline'],
		children: ['set'],
	},
	{
		presetId: 19,
		presetSubtype: 0,
		msoName: 'ColorBlend',
		ribbonName: 'Object Color',
		attrNames: ['style.color', 'fillcolor', 'fill.type', 'fill.on'],
		children: ['animClr', 'set'],
	},
];
