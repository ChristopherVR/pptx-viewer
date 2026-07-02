/**
 * smart-art-presets.ts: the SmartArt insert-gallery catalogue, shared across
 * bindings. Pure data + types; consumed by each binding's insert dialog and
 * preview thumbnails. Each preset names a core {@link SmartArtLayout}, the
 * sidebar category it lives under, a label, and the default node texts inserted
 * when the user picks it without editing.
 */

import type { SmartArtLayout } from 'pptx-viewer-core';

/** The five categories surfaced in the dialog's left sidebar. */
export type SmartArtCategory = 'list' | 'process' | 'cycle' | 'hierarchy' | 'relationship';

/** A single entry in the SmartArt insert gallery. */
export interface SmartArtPreset {
	/** Core layout kind this preset inserts. */
	layout: SmartArtLayout;
	/** Display label (English fallback). */
	label: string;
	/** Translation key resolving to the label. */
	labelKey: string;
	/** Sidebar category. */
	category: SmartArtCategory;
	/** Default node texts to seed the new SmartArt with. */
	defaultItems: string[];
}

export const PRESETS: SmartArtPreset[] = [
	// List
	{
		layout: 'basicBlockList',
		label: 'Basic Block List',
		labelKey: 'pptx.smartart.preset.basicBlockList',
		category: 'list',
		defaultItems: ['Item 1', 'Item 2', 'Item 3'],
	},
	{
		layout: 'stackedList',
		label: 'Stacked List',
		labelKey: 'pptx.smartart.preset.stackedList',
		category: 'list',
		defaultItems: ['Item 1', 'Item 2', 'Item 3'],
	},
	{
		layout: 'horizontalBulletList',
		label: 'Horizontal Bullet List',
		labelKey: 'pptx.smartart.preset.horizontalBulletList',
		category: 'list',
		defaultItems: ['Topic 1', 'Topic 2', 'Topic 3'],
	},
	{
		layout: 'tableList',
		label: 'Table List',
		labelKey: 'pptx.smartart.preset.tableList',
		category: 'list',
		defaultItems: ['Row 1', 'Row 2', 'Row 3'],
	},
	// Process
	{
		layout: 'basicChevronProcess',
		label: 'Chevron Process',
		labelKey: 'pptx.smartart.preset.basicChevronProcess',
		category: 'process',
		defaultItems: ['Step 1', 'Step 2', 'Step 3'],
	},
	{
		layout: 'segmentedProcess',
		label: 'Segmented Process',
		labelKey: 'pptx.smartart.preset.segmentedProcess',
		category: 'process',
		defaultItems: ['Phase 1', 'Phase 2', 'Phase 3'],
	},
	{
		layout: 'continuousBlockProcess',
		label: 'Continuous Block Process',
		labelKey: 'pptx.smartart.preset.continuousBlockProcess',
		category: 'process',
		defaultItems: ['Start', 'Middle', 'End'],
	},
	{
		layout: 'upwardArrow',
		label: 'Upward Arrow',
		labelKey: 'pptx.smartart.preset.upwardArrow',
		category: 'process',
		defaultItems: ['Stage 1', 'Stage 2', 'Stage 3'],
	},
	// Cycle
	{
		layout: 'basicCycle',
		label: 'Basic Cycle',
		labelKey: 'pptx.smartart.preset.basicCycle',
		category: 'cycle',
		defaultItems: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'],
	},
	{
		layout: 'basicRadial',
		label: 'Basic Radial',
		labelKey: 'pptx.smartart.preset.basicRadial',
		category: 'cycle',
		defaultItems: ['Center', 'Spoke 1', 'Spoke 2', 'Spoke 3'],
	},
	{
		layout: 'basicPie',
		label: 'Basic Pie',
		labelKey: 'pptx.smartart.preset.basicPie',
		category: 'cycle',
		defaultItems: ['Segment 1', 'Segment 2', 'Segment 3'],
	},
	{
		layout: 'convergingRadial',
		label: 'Converging Radial',
		labelKey: 'pptx.smartart.preset.convergingRadial',
		category: 'cycle',
		defaultItems: ['Goal', 'Input 1', 'Input 2', 'Input 3'],
	},
	// Hierarchy
	{
		layout: 'hierarchy',
		label: 'Hierarchy',
		labelKey: 'pptx.smartart.preset.hierarchy',
		category: 'hierarchy',
		defaultItems: ['Manager', 'Lead A', 'Lead B'],
	},
	// Relationship
	{
		layout: 'basicVenn',
		label: 'Basic Venn',
		labelKey: 'pptx.smartart.preset.basicVenn',
		category: 'relationship',
		defaultItems: ['Set A', 'Set B', 'Set C'],
	},
	{
		layout: 'linearVenn',
		label: 'Linear Venn',
		labelKey: 'pptx.smartart.preset.linearVenn',
		category: 'relationship',
		defaultItems: ['Group 1', 'Group 2', 'Group 3'],
	},
	{
		layout: 'alternatingHexagons',
		label: 'Alternating Hexagons',
		labelKey: 'pptx.smartart.preset.alternatingHexagons',
		category: 'relationship',
		defaultItems: ['Hex 1', 'Hex 2', 'Hex 3'],
	},
	{
		layout: 'trapezoidList',
		label: 'Trapezoid List',
		labelKey: 'pptx.smartart.preset.trapezoidList',
		category: 'relationship',
		defaultItems: ['Level 1', 'Level 2', 'Level 3'],
	},
	// Additional List layouts
	{
		layout: 'pictureAccentList',
		label: 'Picture Accent List',
		labelKey: 'pptx.smartart.preset.pictureAccentList',
		category: 'list',
		defaultItems: ['Feature 1', 'Feature 2', 'Feature 3'],
	},
	{
		layout: 'verticalBlockList',
		label: 'Vertical Block List',
		labelKey: 'pptx.smartart.preset.verticalBlockList',
		category: 'list',
		defaultItems: ['Block 1', 'Block 2', 'Block 3'],
	},
	{
		layout: 'groupedList',
		label: 'Grouped List',
		labelKey: 'pptx.smartart.preset.groupedList',
		category: 'list',
		defaultItems: ['Item A', 'Item B', 'Item C', 'Item D'],
	},
	{
		layout: 'horizontalPictureList',
		label: 'Horizontal Picture List',
		labelKey: 'pptx.smartart.preset.horizontalPictureList',
		category: 'list',
		defaultItems: ['Photo 1', 'Photo 2', 'Photo 3'],
	},
	{
		layout: 'verticalChevronList',
		label: 'Vertical Chevron List',
		labelKey: 'pptx.smartart.preset.verticalChevronList',
		category: 'list',
		defaultItems: ['Priority 1', 'Priority 2', 'Priority 3'],
	},
	{
		layout: 'pyramidList',
		label: 'Pyramid List',
		labelKey: 'pptx.smartart.preset.pyramidList',
		category: 'list',
		defaultItems: ['Level 1', 'Level 2', 'Level 3'],
	},
	// Additional Process layouts
	{
		layout: 'stepDownProcess',
		label: 'Step Down Process',
		labelKey: 'pptx.smartart.preset.stepDownProcess',
		category: 'process',
		defaultItems: ['Step 1', 'Step 2', 'Step 3'],
	},
	{
		layout: 'alternatingFlow',
		label: 'Alternating Flow',
		labelKey: 'pptx.smartart.preset.alternatingFlow',
		category: 'process',
		defaultItems: ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4'],
	},
	{
		layout: 'descendingProcess',
		label: 'Descending Process',
		labelKey: 'pptx.smartart.preset.descendingProcess',
		category: 'process',
		defaultItems: ['Top', 'Middle', 'Bottom'],
	},
	{
		layout: 'accentProcess',
		label: 'Accent Process',
		labelKey: 'pptx.smartart.preset.accentProcess',
		category: 'process',
		defaultItems: ['Phase 1', 'Phase 2', 'Phase 3'],
	},
	{
		layout: 'basicTimeline',
		label: 'Basic Timeline',
		labelKey: 'pptx.smartart.preset.basicTimeline',
		category: 'process',
		defaultItems: ['2021', '2022', '2023'],
	},
	{
		layout: 'bendingProcess',
		label: 'Bending Process',
		labelKey: 'pptx.smartart.preset.bendingProcess',
		category: 'process',
		defaultItems: ['Step 1', 'Step 2', 'Step 3', 'Step 4'],
	},
	// Relationship: target / matrix / pyramid / funnel / gear families.
	// These share the dialog's "relationship" sidebar tab (PowerPoint groups
	// matrix/pyramid under separate tabs, which this gallery folds into one).
	{
		layout: 'basicTarget',
		label: 'Basic Target',
		labelKey: 'pptx.smartart.preset.basicTarget',
		category: 'relationship',
		defaultItems: ['Outer', 'Middle', 'Inner'],
	},
	{
		layout: 'interlockingGears',
		label: 'Interlocking Gears',
		labelKey: 'pptx.smartart.preset.interlockingGears',
		category: 'relationship',
		defaultItems: ['Gear 1', 'Gear 2', 'Gear 3'],
	},
	{
		layout: 'basicMatrix',
		label: 'Basic Matrix',
		labelKey: 'pptx.smartart.preset.basicMatrix',
		category: 'relationship',
		defaultItems: ['Quadrant 1', 'Quadrant 2', 'Quadrant 3', 'Quadrant 4'],
	},
	{
		layout: 'basicPyramid',
		label: 'Basic Pyramid',
		labelKey: 'pptx.smartart.preset.basicPyramid',
		category: 'relationship',
		defaultItems: ['Top', 'Middle', 'Base'],
	},
	{
		layout: 'invertedPyramid',
		label: 'Inverted Pyramid',
		labelKey: 'pptx.smartart.preset.invertedPyramid',
		category: 'relationship',
		defaultItems: ['Wide', 'Narrower', 'Tip'],
	},
	{
		layout: 'basicFunnel',
		label: 'Basic Funnel',
		labelKey: 'pptx.smartart.preset.basicFunnel',
		category: 'relationship',
		defaultItems: ['Input 1', 'Input 2', 'Input 3', 'Result'],
	},
];

/** Sidebar tabs, in display order. */
export const CATEGORIES: Array<{ id: SmartArtCategory; label: string; labelKey: string }> = [
	{ id: 'list', label: 'List', labelKey: 'pptx.smartart.category.list' },
	{ id: 'process', label: 'Process', labelKey: 'pptx.smartart.category.process' },
	{ id: 'cycle', label: 'Cycle', labelKey: 'pptx.smartart.category.cycle' },
	{ id: 'hierarchy', label: 'Hierarchy', labelKey: 'pptx.smartart.category.hierarchy' },
	{ id: 'relationship', label: 'Relationship', labelKey: 'pptx.smartart.category.relationship' },
];
