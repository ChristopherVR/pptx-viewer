import { mount } from '@vue/test-utils';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { ENTRANCE_PRESETS, EXIT_PRESETS, ooxmlToPresetName } from 'pptx-viewer-core';
import { motionPathPresetById } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import AnimationPanel from './AnimationPanel.vue';

/** Mirror the panel's catalog-id → real-preset conversion for assertions. */
function presetOf(catalogId: string): string {
	const dot = catalogId.indexOf('.');
	const cls = catalogId.slice(0, dot);
	const num = Number(catalogId.slice(dot + 1));
	if (cls === 'entr' || cls === 'exit' || cls === 'emph') {
		return ooxmlToPresetName({ presetClass: cls, presetId: num }) ?? catalogId;
	}
	return catalogId;
}

type AnimatableElement = PptxElement & { animations?: PptxElementAnimation[] };

function makeElement(animations?: PptxElementAnimation[]): AnimatableElement {
	return {
		type: 'shape',
		id: 'sp1',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		...(animations ? { animations } : {}),
	} as AnimatableElement;
}

function lastUpdatePatch(wrapper: ReturnType<typeof mount>): Partial<AnimatableElement> {
	const events = wrapper.emitted('update');
	expect(events).toBeTruthy();
	const payload = events?.at(-1)?.[0];
	return payload as Partial<AnimatableElement>;
}

describe('animationPanel', () => {
	it('lists the element current animations with preset name and trigger', () => {
		const wrapper = mount(AnimationPanel, {
			props: {
				element: makeElement([{ elementId: 'sp1', entrance: 'entr.10', trigger: 'onClick' }]),
			},
		});
		const rows = wrapper.findAll('.pptx-vue-anim-row');
		expect(rows).toHaveLength(1);
		// `entr.10` resolves to the "Fade" catalog label.
		expect(rows[0].text()).toContain('Fade');
		expect(rows[0].text()).toContain('On click');
	});

	it('adding a preset emits { animations: [...] } with the new entry appended', async () => {
		const wrapper = mount(AnimationPanel, {
			props: { element: makeElement() },
		});

		// Default category is entrance; pick the second entrance preset.
		const presetSelect = wrapper.get('select[aria-label="Animation preset"]');
		const chosen = ENTRANCE_PRESETS[1];
		await presetSelect.setValue(chosen.presetId);

		const triggerSelect = wrapper.get('select[aria-label="Animation trigger"]');
		await triggerSelect.setValue('withPrevious');

		await wrapper.get('.pptx-vue-anim-add-btn').trigger('click');

		const patch = lastUpdatePatch(wrapper);
		expect(Array.isArray(patch.animations)).toBeTruthy();
		expect(patch.animations).toHaveLength(1);
		const added = patch.animations?.[0];
		expect(added).toMatchObject({
			elementId: 'sp1',
			entrance: presetOf(chosen.presetId),
			trigger: 'withPrevious',
			durationMs: chosen.defaultDurationMs,
			order: 0,
		});
	});

	it('adding appends to the existing animations array', async () => {
		const existing: PptxElementAnimation = {
			elementId: 'sp1',
			entrance: 'entr.10',
			trigger: 'onClick',
		};
		const wrapper = mount(AnimationPanel, {
			props: { element: makeElement([existing]) },
		});

		// Switch category to exit, choose the first exit preset.
		const categorySelect = wrapper.get('select[aria-label="Animation category"]');
		await categorySelect.setValue('exit');

		const presetSelect = wrapper.get('select[aria-label="Animation preset"]');
		const chosen = EXIT_PRESETS[0];
		await presetSelect.setValue(chosen.presetId);

		await wrapper.get('.pptx-vue-anim-add-btn').trigger('click');

		const patch = lastUpdatePatch(wrapper);
		expect(patch.animations).toHaveLength(2);
		expect(patch.animations?.[0]).toMatchObject(existing);
		expect(patch.animations?.[1]).toMatchObject({
			elementId: 'sp1',
			exit: presetOf(chosen.presetId),
			order: 1,
		});
	});

	it('removing emits the shorter array', async () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'sp1', entrance: 'entr.10', trigger: 'onClick' },
			{ elementId: 'sp1', exit: 'exit.10', trigger: 'afterPrevious' },
		];
		const wrapper = mount(AnimationPanel, {
			props: { element: makeElement(animations) },
		});

		const removeButtons = wrapper.findAll('.pptx-vue-anim-remove');
		expect(removeButtons).toHaveLength(2);
		await removeButtons[0].trigger('click');

		const patch = lastUpdatePatch(wrapper);
		expect(patch.animations).toHaveLength(1);
		// The first entry was removed; the remaining one is the exit animation.
		expect(patch.animations?.[0]).toMatchObject({ elementId: 'sp1', exit: 'exit.10' });
	});
});

/**
 * The motion-path row commits to the SLIDE's animation list, not the element
 * patch, because that is the list the canvas overlay and the ribbon gallery
 * both read and write.
 */
describe('animationPanel motion path', () => {
	function mountPanel(slideAnimations: PptxElementAnimation[] = []) {
		return mount(AnimationPanel, { props: { element: makeElement(), slideAnimations } });
	}

	function lastSlideAnimations(
		wrapper: ReturnType<typeof mount>,
	): PptxElementAnimation[] | undefined {
		return wrapper.emitted('updateSlideAnimations')?.at(-1)?.[0] as
			| PptxElementAnimation[]
			| undefined;
	}

	it('reflects the path already applied to the selected element', () => {
		const wrapper = mountPanel([
			{ elementId: 'sp1', motionPath: motionPathPresetById('lineDown')?.path },
		]);
		expect(
			(wrapper.get('.pptx-vue-motion-path-row select').element as HTMLSelectElement).value,
		).toBe('lineDown');
	});

	it('applies a chosen preset to the slide animation list', async () => {
		const wrapper = mountPanel();
		await wrapper.get('.pptx-vue-motion-path-row select').setValue('lineRight');

		expect(lastSlideAnimations(wrapper)).toStrictEqual([
			expect.objectContaining({
				elementId: 'sp1',
				motionPath: motionPathPresetById('lineRight')?.path,
				motionPathEditMode: 'relative',
			}),
		]);
	});

	it('clears the path, and with it an entry that carried nothing else', async () => {
		const wrapper = mountPanel([
			{ elementId: 'sp1', motionPath: motionPathPresetById('lineRight')?.path },
		]);
		await wrapper.get('.pptx-vue-motion-path-row select').setValue('none');

		expect(lastSlideAnimations(wrapper)).toStrictEqual([]);
	});

	/** Clearing the path must not delete an entry that still has a preset. */
	it('keeps a preset on the entry when only the path is cleared', async () => {
		const wrapper = mountPanel([
			{ elementId: 'sp1', entrance: 'fadeIn', motionPath: 'M 0 0 L 0.25 0' },
		]);
		await wrapper.get('.pptx-vue-motion-path-row select').setValue('none');

		const next = lastSlideAnimations(wrapper);
		expect(next).toHaveLength(1);
		expect(next?.[0]).toMatchObject({ elementId: 'sp1', entrance: 'fadeIn' });
		expect(next?.[0].motionPath).toBeUndefined();
	});
});
