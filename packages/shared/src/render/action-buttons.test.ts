import { describe, it, expect } from 'vitest';

import {
	ACTION_BUTTON_DEFAULT_ACTIONS,
	ACTION_BUTTON_PRESETS,
	isActionButton,
} from './action-buttons';

describe('action button presets', () => {
	it('contains the 12 ooxml action button presets', () => {
		expect(ACTION_BUTTON_PRESETS).toHaveLength(12);
	});

	it('every shape type starts with actionButton and is a known action button', () => {
		for (const preset of ACTION_BUTTON_PRESETS) {
			expect(preset.shapeType).toMatch(/^actionButton/u);
			expect(isActionButton(preset.shapeType)).toBeTruthy();
		}
	});

	it('all shape types are unique', () => {
		const types = ACTION_BUTTON_PRESETS.map((p) => p.shapeType);
		expect(new Set(types).size).toBe(types.length);
	});

	it('navigation presets carry the expected default actions', () => {
		const byType = new Map(ACTION_BUTTON_PRESETS.map((p) => [p.shapeType, p.defaultAction]));
		expect(byType.get('actionButtonBackPrevious')).toBe('prevSlide');
		expect(byType.get('actionButtonForwardNext')).toBe('nextSlide');
		expect(byType.get('actionButtonBeginning')).toBe('firstSlide');
		expect(byType.get('actionButtonEnd')).toBe('lastSlide');
	});

	it('non-blank presets carry svg path glyph data', () => {
		for (const preset of ACTION_BUTTON_PRESETS) {
			if (preset.shapeType === 'actionButtonBlank') {
				expect(preset.iconPath).toBe('');
				continue;
			}
			expect(preset.iconPath).toMatch(/[MLZCQSTAHVmlzcqstahv]/u);
		}
	});
});

describe('action button default action map', () => {
	it('has one entry per preset mapping to its default action', () => {
		expect(Object.keys(ACTION_BUTTON_DEFAULT_ACTIONS)).toHaveLength(ACTION_BUTTON_PRESETS.length);
		for (const preset of ACTION_BUTTON_PRESETS) {
			expect(ACTION_BUTTON_DEFAULT_ACTIONS[preset.shapeType]).toBe(preset.defaultAction);
		}
	});
});
