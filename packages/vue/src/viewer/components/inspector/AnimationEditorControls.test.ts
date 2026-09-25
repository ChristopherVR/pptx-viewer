import { mount } from '@vue/test-utils';
import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import AnimationEditorControls from './AnimationEditorControls.vue';
import { setControlValue } from './test-control-value';

/**
 * The direction / sequence / timing-curve selects printed their raw
 * `PptxAnimation*` values (`fromBottomLeft`, `byParagraph`, `ease-in`) as option
 * text. Each test below asserts the spelling AND the unchanged value list,
 * because the value is what is patched onto the animation and what React is
 * diffed against; a value change here would be a behaviour change, not a
 * wording one.
 */
function animation(entrance: string = 'flyIn'): PptxElementAnimation {
	return {
		elementId: 'el-1',
		order: 0,
		trigger: 'onClick',
		entrance,
	} as PptxElementAnimation;
}

function mountWith(entrance?: string) {
	return mount(AnimationEditorControls, {
		props: { animation: animation(entrance), elements: [] },
	});
}

function selectByLabel(label: string, entrance?: string) {
	return mountWith(entrance).get(`pptx-ui-select[aria-label="${label}"]`).findAll('option');
}

describe('animationEditorControls - direction', () => {
	it("offers Fly's eight directions (edges first), from the shared catalogue", () => {
		expect(
			selectByLabel('Direction').map((o) => (o.element as HTMLOptionElement).value),
		).toStrictEqual([
			'fromTop',
			'fromBottom',
			'fromLeft',
			'fromRight',
			'fromTopLeft',
			'fromTopRight',
			'fromBottomLeft',
			'fromBottomRight',
		]);
	});

	it('spells each direction', () => {
		expect(selectByLabel('Direction').map((o) => o.text())).toStrictEqual([
			'From Top',
			'From Bottom',
			'From Left',
			'From Right',
			'From Top Left',
			'From Top Right',
			'From Bottom Left',
			'From Bottom Right',
		]);
	});

	it('offers only the four edges PowerPoint has for Wipe', () => {
		expect(
			selectByLabel('Direction', 'wipeIn').map((o) => (o.element as HTMLOptionElement).value),
		).toStrictEqual(['fromTop', 'fromBottom', 'fromLeft', 'fromRight']);
	});

	it('shows no direction for a preset without variants', () => {
		expect(mountWith('fadeIn').find('pptx-ui-select[aria-label="Direction"]').exists()).toBeFalsy();
	});
});

describe('animationEditorControls - sequence', () => {
	it('keeps its values and spells them', () => {
		const options = selectByLabel('Sequence');
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
		const options = selectByLabel('Timing curve');
		expect(options.map((o) => (o.element as HTMLOptionElement).value)).toStrictEqual([
			'ease',
			'ease-in',
			'ease-out',
			'linear',
		]);
		expect(options.map((o) => o.text())).toStrictEqual(['Ease', 'Ease In', 'Ease Out', 'Linear']);
	});

	it('shows an unset curve as Linear: the writer saves it as accel=0 decel=0', () => {
		const wrapper = mount(AnimationEditorControls, {
			props: { animation: animation(), elements: [] },
		});
		const select = wrapper.get('pptx-ui-select[aria-label="Timing curve"]').element;
		const value =
			(select as HTMLElement & { value?: string }).value ?? select.getAttribute('value');
		expect(value).toBe('linear');
	});
});

/**
 * The Vue patch path bypassed the shared granular setters entirely, so
 * out-of-range duration/delay/repeatCount were forwarded verbatim onto the
 * animation entry, unlike Angular (shared re-export shim) and Svelte
 * (`AnimationTimingFields.svelte`) which both clamp through
 * `setDuration`/`setDelay`/`setRepeatCount`. These assert the same clamps now
 * apply here.
 */
describe('animationEditorControls - timing field clamping', () => {
	function lastPatch(wrapper: ReturnType<typeof mount>): Partial<PptxElementAnimation> {
		const events = wrapper.emitted('patch');
		expect(events).toBeTruthy();
		return events?.at(-1)?.[0] as Partial<PptxElementAnimation>;
	}

	it('clamps an out-of-range low duration up to 100ms', async () => {
		const wrapper = mount(AnimationEditorControls, {
			props: { animation: animation(), elements: [] },
		});
		await setControlValue(wrapper.get('input[aria-label="Duration (ms)"]'), 50);
		expect(lastPatch(wrapper)).toStrictEqual({ durationMs: 100 });
	});

	it('clamps an out-of-range high duration down to 10000ms', async () => {
		const wrapper = mount(AnimationEditorControls, {
			props: { animation: animation(), elements: [] },
		});
		await setControlValue(wrapper.get('input[aria-label="Duration (ms)"]'), 50000);
		expect(lastPatch(wrapper)).toStrictEqual({ durationMs: 10000 });
	});

	it('clamps a negative delay up to 0ms', async () => {
		const wrapper = mount(AnimationEditorControls, {
			props: { animation: animation(), elements: [] },
		});
		await setControlValue(wrapper.get('input[aria-label="Delay (ms)"]'), -500);
		expect(lastPatch(wrapper)).toStrictEqual({ delayMs: 0 });
	});

	it('clamps an out-of-range high repeat count down to 100', async () => {
		const wrapper = mount(AnimationEditorControls, {
			props: { animation: animation(), elements: [] },
		});
		await setControlValue(wrapper.get('input[aria-label="Repeat count"]'), 500);
		expect(lastPatch(wrapper)).toStrictEqual({ repeatCount: 100 });
	});

	it('clamps a zero repeat count up to 1', async () => {
		const wrapper = mount(AnimationEditorControls, {
			props: { animation: animation(), elements: [] },
		});
		await setControlValue(wrapper.get('input[aria-label="Repeat count"]'), 0);
		expect(lastPatch(wrapper)).toStrictEqual({ repeatCount: 1 });
	});

	it('passes an in-range duration through unchanged', async () => {
		const wrapper = mount(AnimationEditorControls, {
			props: { animation: animation(), elements: [] },
		});
		await setControlValue(wrapper.get('input[aria-label="Duration (ms)"]'), 750);
		expect(lastPatch(wrapper)).toStrictEqual({ durationMs: 750 });
	});
});
