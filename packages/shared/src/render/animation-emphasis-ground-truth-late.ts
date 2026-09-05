/**
 * `animation-emphasis-ground-truth-late` - emphasis ground-truth rows for
 * preset ids 20-41 (Color Wave through the two unnamed "3D" custom items).
 * Split out of `animation-emphasis-ground-truth.ts` to keep that module
 * under the repo's file-size guideline; see that module's doc for the
 * COM/UI-Automation methodology, and `animation-emphasis-ground-truth.ts`
 * for the composed table this feeds.
 *
 * @module render/animation-emphasis-ground-truth-late
 */

import type { AnimationEmphasisGroundTruthRow } from './animation-emphasis-ground-truth-types';

export const ANIMATION_EMPHASIS_GROUND_TRUTH_LATE: readonly AnimationEmphasisGroundTruthRow[] = [
	{
		presetId: 20,
		presetSubtype: 0,
		msoName: 'ColorWave',
		attrNames: ['style.color', 'fillcolor', 'fill.type'],
		children: ['set'],
	},
	{
		presetId: 21,
		presetSubtype: 0,
		msoName: 'ComplementaryColor',
		ribbonName: 'Complementary Color',
		attrNames: ['style.color', 'fillcolor', 'stroke.color', 'fill.type'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 22,
		presetSubtype: 0,
		msoName: 'ComplementaryColor2',
		attrNames: ['style.color', 'fillcolor', 'stroke.color', 'fill.type'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 23,
		presetSubtype: 0,
		msoName: 'ContrastingColor',
		attrNames: ['style.color', 'fillcolor', 'stroke.color', 'fill.type'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 24,
		presetSubtype: 0,
		msoName: 'Darken',
		ribbonName: 'Darken',
		attrNames: ['style.color', 'fillcolor', 'stroke.color', 'fill.type'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 25,
		presetSubtype: 0,
		msoName: 'Desaturate',
		ribbonName: 'Desaturate',
		attrNames: ['style.color', 'fillcolor', 'stroke.color', 'fill.type'],
		children: ['animClr', 'set'],
	},
	{
		// The definitive resolution of the "emph.26: Pulse or Flash Bulb?"
		// question: BOTH names produced this exact row (filter="fade" with a
		// tmFilter flash curve, plus a 105%/105% autoRev animScale). They are
		// the same preset, not two effects swapped onto one id.
		presetId: 26,
		presetSubtype: 0,
		msoName: 'FlashBulb',
		ribbonName: 'Pulse',
		filter: 'fade',
		children: ['anim', 'animScale'],
	},
	{
		// Same pattern as id 26: Flicker (VBA name) and Color Pulse (ribbon
		// name) produced identical XML.
		presetId: 27,
		presetSubtype: 0,
		msoName: 'Flicker',
		ribbonName: 'Color Pulse',
		attrNames: ['style.color', 'fillcolor', 'fill.type', 'fill.on'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 28,
		presetSubtype: 0,
		msoName: 'GrowWithColor',
		attrNames: ['style.color', 'fillcolor', 'fill.type', 'style.fontSize'],
		children: ['anim', 'animClr', 'set'],
	},
	{
		presetId: 30,
		presetSubtype: 0,
		msoName: 'Lighten',
		ribbonName: 'Lighten',
		attrNames: ['style.color', 'fillcolor', 'stroke.color', 'fill.type'],
		children: ['animClr', 'set'],
	},
	{
		presetId: 31,
		presetSubtype: 0,
		msoName: 'StyleEmphasis',
		attrNames: [
			'style.color',
			'style.fontStyle',
			'style.fontWeight',
			'style.textDecorationUnderline',
		],
		children: ['set'],
	},
	{
		presetId: 32,
		presetSubtype: 0,
		msoName: 'Teeter',
		ribbonName: 'Teeter',
		attrNames: ['r'],
		children: ['animRot'],
	},
	{
		presetId: 33,
		presetSubtype: 0,
		msoName: 'VerticalGrow',
		attrNames: ['style.color', 'fillcolor', 'fill.type', 'fill.on'],
		children: ['animClr', 'animScale', 'set'],
	},
	{
		presetId: 34,
		presetSubtype: 0,
		msoName: 'Wave',
		ribbonName: 'Wave',
		attrNames: ['ppt_x', 'ppt_y', 'r'],
		children: ['animMotion', 'animRot'],
	},
	{
		// Ribbon-only: no `MsoAnimEffect` constant reaches it. A discrete
		// (non-interpolated) `style.visibility` hidden/visible toggle.
		presetId: 35,
		presetSubtype: 0,
		ribbonName: 'Blink',
		attrNames: ['style.visibility'],
		children: ['anim'],
	},
	{
		// Ribbon-only. A horizontal wiggle (`ppt_w`-relative `p:anim`) plus an
		// 80%/100% autoRev `p:animScale` squeeze.
		presetId: 36,
		presetSubtype: 0,
		ribbonName: 'Shimmer',
		children: ['anim', 'animScale'],
	},
	{
		// The "Add Emphasis Effect" dialog's "3D" group has two unnamed
		// "Custom" items; both saved with `grpId="1"` and a completely empty
		// `<p:childTnLst>` - nothing 2D-representable to render.
		presetId: 40,
		presetSubtype: 0,
		ribbonName: 'Custom (3D)',
		children: [],
		noAnimationContent: true,
	},
	{
		presetId: 41,
		presetSubtype: 0,
		ribbonName: 'Custom (3D)',
		children: [],
		noAnimationContent: true,
	},
];
