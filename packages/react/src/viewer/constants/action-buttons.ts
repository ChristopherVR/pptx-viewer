/**
 * OOXML built-in action button presets and default action map.
 */

import type { ActionButtonPreset } from 'pptx-viewer-core';

export const ACTION_BUTTON_PRESETS: ActionButtonPreset[] = [
	{
		shapeType: 'actionButtonBackPrevious',
		label: 'Back / Previous',
		defaultAction: 'prevSlide',
		iconPath: 'M16 4 L4 12 L16 20 Z',
	},
	{
		shapeType: 'actionButtonForwardNext',
		label: 'Forward / Next',
		defaultAction: 'nextSlide',
		iconPath: 'M8 4 L20 12 L8 20 Z',
	},
	{
		shapeType: 'actionButtonBeginning',
		label: 'Home / First',
		defaultAction: 'firstSlide',
		iconPath: 'M4 4 L4 20 M6 12 L18 4 L18 20 Z',
	},
	{
		shapeType: 'actionButtonEnd',
		label: 'End / Last',
		defaultAction: 'lastSlide',
		iconPath: 'M20 4 L20 20 M18 12 L6 4 L6 20 Z',
	},
	{
		shapeType: 'actionButtonReturn',
		label: 'Return',
		defaultAction: 'prevSlide',
		iconPath: 'M18 8 L18 14 L6 14 M6 14 L10 10 M6 14 L10 18',
	},
	{
		shapeType: 'actionButtonHome',
		label: 'Home',
		defaultAction: 'firstSlide',
		// House: roof + body
		iconPath: 'M12 4 L20 11 L20 20 L14 20 L14 14 L10 14 L10 20 L4 20 L4 11 Z',
	},
	{
		shapeType: 'actionButtonHelp',
		label: 'Help',
		defaultAction: 'none',
		// Question mark
		iconPath: 'M9 9 a3 3 0 1 1 4 2.8 c-1 0.4 -1 1.2 -1 2 M12 17 v0.5',
	},
	{
		shapeType: 'actionButtonInformation',
		label: 'Information',
		defaultAction: 'none',
		// Lower-case "i": dot + body
		iconPath: 'M12 6 v0.01 M12 10 v8',
	},
	{
		shapeType: 'actionButtonDocument',
		label: 'Document',
		defaultAction: 'none',
		// Document with folded corner
		iconPath: 'M6 4 L14 4 L18 8 L18 20 L6 20 Z M14 4 L14 8 L18 8',
	},
	{
		shapeType: 'actionButtonSound',
		label: 'Sound',
		defaultAction: 'none',
		// Speaker cone + sound waves
		iconPath: 'M4 10 L4 14 L8 14 L12 18 L12 6 L8 10 Z M16 9 a4 4 0 0 1 0 6 M18 7 a7 7 0 0 1 0 10',
	},
	{
		shapeType: 'actionButtonMovie',
		label: 'Movie',
		defaultAction: 'none',
		// Film strip with play triangle
		iconPath: 'M4 6 L20 6 L20 18 L4 18 Z M10 9 L15 12 L10 15 Z',
	},
	{
		shapeType: 'actionButtonBlank',
		label: 'Custom',
		defaultAction: 'none',
		// No glyph — empty path. The button still renders as a rounded rect via clip-path.
		iconPath: '',
	},
];

/** Map from action button shape type to its default action type. */
export const ACTION_BUTTON_DEFAULT_ACTIONS: Record<string, ActionButtonPreset['defaultAction']> =
	Object.fromEntries(ACTION_BUTTON_PRESETS.map((p) => [p.shapeType, p.defaultAction]));
