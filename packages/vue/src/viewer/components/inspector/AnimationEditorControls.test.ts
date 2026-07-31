import { mount } from '@vue/test-utils';
import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import AnimationEditorControls from './AnimationEditorControls.vue';

/**
 * The direction / sequence / timing-curve selects printed their raw
 * `PptxAnimation*` values (`fromBottomLeft`, `byParagraph`, `ease-in`) as option
 * text. Each test below asserts the spelling AND the unchanged value list,
 * because the value is what is patched onto the animation and what React is
 * diffed against; a value change here would be a behaviour change, not a
 * wording one.
 */
function animation(): PptxElementAnimation {
	return {
		elementId: 'el-1',
		order: 0,
		trigger: 'onClick',
		entrance: 'fade',
	} as PptxElementAnimation;
}

function selectByLabel(label: string) {
	const wrapper = mount(AnimationEditorControls, {
		props: { animation: animation(), elements: [] },
	});
	return wrapper.get(`select[aria-label="${label}"]`).findAll('option');
}

describe('animationEditorControls - direction', () => {
	it('keeps all eight direction values', () => {
		expect(
			selectByLabel('Animation direction').map((o) => (o.element as HTMLOptionElement).value),
		).toStrictEqual([
			'fromLeft',
			'fromRight',
			'fromTop',
			'fromBottom',
			'fromTopLeft',
			'fromTopRight',
			'fromBottomLeft',
			'fromBottomRight',
		]);
	});

	it('spells each direction', () => {
		expect(selectByLabel('Animation direction').map((o) => o.text())).toStrictEqual([
			'From Left',
			'From Right',
			'From Top',
			'From Bottom',
			'From Top Left',
			'From Top Right',
			'From Bottom Left',
			'From Bottom Right',
		]);
	});
});

describe('animationEditorControls - sequence', () => {
	it('keeps its values and spells them', () => {
		const options = selectByLabel('Animation sequence');
		expect(options.map((o) => (o.element as HTMLOptionElement).value)).toStrictEqual([
			'asOne',
			'byParagraph',
			'byWord',
			'byLetter',
		]);
		expect(options.map((o) => o.text())).toStrictEqual([
			'As One Object',
			'By Paragraph',
			'By Word',
			'By Letter',
		]);
	});
});

describe('animationEditorControls - timing curve', () => {
	/**
	 * The curve values are kebab-case while their dictionary keys are camelCase,
	 * so a naive `t('...' + value)` would miss on two of the four. This is the
	 * test that would catch that regression.
	 */
	it('keeps its kebab-case values and still resolves a label for each', () => {
		const options = selectByLabel('Animation timing curve');
		expect(options.map((o) => (o.element as HTMLOptionElement).value)).toStrictEqual([
			'ease',
			'ease-in',
			'ease-out',
			'linear',
		]);
		expect(options.map((o) => o.text())).toStrictEqual(['Ease', 'Ease In', 'Ease Out', 'Linear']);
	});
});
