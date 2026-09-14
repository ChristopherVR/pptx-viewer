import { describe, expect, it } from 'vitest';

import type { PlaceholderDefaults, PptxElement, TextStyle } from '../../types';
import {
	enrichEmptyPlaceholderPrompts,
	isEmptyTextElement,
} from './layout-switch-placeholder-prompts';

function textElement(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'ph-title-0-x',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		text: '',
		...overrides,
	} as PptxElement;
}

const TITLE_DEFAULTS: PlaceholderDefaults = {
	type: 'title',
	promptText: 'Click to add title',
	textAnchor: 'b',
	levelStyles: { 0: { fontFamily: 'Calibri Light', fontSize: 58.67, bold: true } },
};

function resolver(defaults: PlaceholderDefaults | undefined, type: string | undefined) {
	return {
		resolveDefaults: () => defaults,
		placeholderType: () => type,
		applyBodyDefaults: (textStyle: TextStyle, d: PlaceholderDefaults) => {
			if (d.textAnchor) {
				textStyle.vAlign = d.textAnchor === 'b' ? 'bottom' : 'top';
			}
		},
		applyLevelDefaults: (
			textStyle: TextStyle,
			level: NonNullable<PlaceholderDefaults['levelStyles']>[number],
		) => {
			textStyle.fontFamily ??= level.fontFamily;
			textStyle.fontSize ??= level.fontSize;
			textStyle.bold ??= level.bold;
		},
	};
}

describe('isEmptyTextElement', () => {
	it('is true only for a text element with no characters', () => {
		expect(isEmptyTextElement(textElement())).toBeTruthy();
		expect(isEmptyTextElement(textElement({ text: '  ' }))).toBeTruthy();
		expect(isEmptyTextElement(textElement({ text: 'Hi' }))).toBeFalsy();
		expect(
			isEmptyTextElement(textElement({ textSegments: [{ text: 'x', style: {} }] })),
		).toBeFalsy();
		expect(isEmptyTextElement({ ...textElement(), type: 'image' } as PptxElement)).toBeFalsy();
	});
});

describe('enrichEmptyPlaceholderPrompts', () => {
	it('gives an empty placeholder its layout prompt, type and level-1 defaults', () => {
		const [result] = enrichEmptyPlaceholderPrompts(
			[textElement()],
			resolver(TITLE_DEFAULTS, 'title'),
		) as Array<
			PptxElement & { placeholderType?: string; promptText?: string; textStyle?: TextStyle }
		>;

		expect(result.promptText).toBe('Click to add title');
		expect(result.placeholderType).toBe('title');
		expect(result.textStyle).toStrictEqual({
			vAlign: 'bottom',
			fontFamily: 'Calibri Light',
			fontSize: 58.67,
			bold: true,
		});
	});

	it('keeps an authored style value over the inherited one', () => {
		const [result] = enrichEmptyPlaceholderPrompts(
			[textElement({ textStyle: { fontFamily: 'Georgia' } } as Partial<PptxElement>)],
			resolver(TITLE_DEFAULTS, 'title'),
		) as Array<PptxElement & { textStyle?: TextStyle }>;
		expect(result.textStyle?.fontFamily).toBe('Georgia');
		expect(result.textStyle?.fontSize).toBe(58.67);
	});

	it('returns non-empty, non-placeholder and already-prompted elements untouched', () => {
		const filled = textElement({ id: 'a', text: 'Hello' });
		const prompted = textElement({ id: 'b', promptText: 'Existing' } as Partial<PptxElement>);
		const plain = textElement({ id: 'c' });
		const result = enrichEmptyPlaceholderPrompts(
			[filled, prompted, plain],
			resolver(undefined, undefined),
		);
		expect(result[0]).toBe(filled);
		expect(result[1]).toBe(prompted);
		expect(result[2]).toBe(plain);
	});

	it('does not mutate the input elements', () => {
		const input = textElement();
		enrichEmptyPlaceholderPrompts([input], resolver(TITLE_DEFAULTS, 'title'));
		expect((input as { promptText?: string }).promptText).toBeUndefined();
		expect(input.textStyle).toBeUndefined();
	});
});
