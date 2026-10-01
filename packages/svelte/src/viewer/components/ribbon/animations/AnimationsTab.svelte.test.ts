import {
	DEFAULT_MOTION_PATH_PRESET_ID,
	motionPathPresetById,
	MOTION_PATH_PRESETS,
	registerPptxWebControls,
} from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import { ChromeUiState } from '../../../state/chrome-ui.svelte';
import AnimationsTab from './AnimationsTab.svelte';

registerPptxWebControls();

/**
 * AnimationsTab adapter tests: the shared view emits typed intents and this
 * binding applies them through `EditorState.animationOps` and the chrome state.
 * Covers the commands that add an effect, the ones that route to the
 * inspector, selection/read-only gating and the placeholders React parks.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

function makeEditor(editable = true, selected = true): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = editable;
	editor.setSlides([
		{
			id: 's1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [
				{ type: 'text', id: 'text-1', x: 0, y: 0, width: 10, height: 10, text: 'a', textStyle: {} },
			],
		},
	]);
	if (selected) {
		editor.select('text-1');
	}
	return editor;
}

function mountTab(editor: EditorState, chromeUi?: ChromeUiState): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(AnimationsTab, { target, props: { editor, chromeUi } });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}

function control(target: HTMLElement, id: string): HTMLButtonElement {
	return target
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}

describe('animationsTab', () => {
	it('offers the Advanced Animation commands and the whole shared catalogue', () => {
		const target = mountTab(makeEditor());
		for (const id of [
			'animations.advancedAnimation.addAnimation',
			'animations.animation.effectOptions',
			'animations.advancedAnimation.animationPane',
			'animations.advancedAnimation.trigger',
			'animations.advancedAnimation.animationPainter',
			'animations.advancedAnimation.remove',
		]) {
			expect(control(target, id), `${id} is missing from the Animations tab`).toBeDefined();
		}
		expect(control(target, 'animations.advancedAnimation.animationPainter').disabled).toBeTruthy();
		expect(
			target
				.querySelector('[data-ribbon-control="animations.motionPath.gallery"]')!
				.querySelectorAll('button'),
		).toHaveLength(MOTION_PATH_PRESETS.length);
	});

	it('gates every selection-bound command on a selection and edit permission', () => {
		for (const editor of [makeEditor(true, false), makeEditor(false, true)]) {
			const target = mountTab(editor);
			for (const id of [
				'animations.advancedAnimation.addAnimation',
				'animations.animation.effectOptions',
				'animations.advancedAnimation.trigger',
				'animations.advancedAnimation.remove',
			]) {
				expect(control(target, id).disabled, `${id} needs a selected element`).toBeTruthy();
			}
			expect(
				target.querySelector<HTMLButtonElement>('[data-animation-preset]')!.disabled,
			).toBeTruthy();
			// The panel is worth opening with nothing selected.
			expect(control(target, 'animations.advancedAnimation.animationPane').disabled).toBeFalsy();
			cleanup?.();
		}
	});

	it('adds real effects from the gallery and Exit Effects', () => {
		const editor = makeEditor();
		const target = mountTab(editor);
		target.querySelector<HTMLButtonElement>('[data-animation-preset="flyIn"]')!.click();
		flushSync();
		expect(editor.slides[0]?.animations?.[0]).toMatchObject({
			elementId: 'text-1',
			entrance: 'flyIn',
		});
		control(target, 'animations.advancedAnimation.addAnimation').click();
		flushSync();
		expect(editor.slides[0]?.animations?.[0]).toMatchObject({ exit: 'fadeOut' });
	});

	it('applies the default MOTION PATH from Path Animation, and removes it again', () => {
		const editor = makeEditor();
		const target = mountTab(editor);

		target
			.querySelectorAll('pptx-ui-ribbon-command')[2]
			.shadowRoot!.querySelector('button')!
			.click();
		flushSync();
		// It used to add a Fly In entrance, which is not a path at all.
		expect(editor.slides[0]?.animations?.[0]).toMatchObject({
			elementId: 'text-1',
			motionPath: motionPathPresetById(DEFAULT_MOTION_PATH_PRESET_ID)?.path,
			motionPathEditMode: 'relative',
		});
		expect(editor.slides[0]?.animations?.[0]?.entrance).toBeUndefined();

		control(target, 'animations.advancedAnimation.remove').click();
		flushSync();
		expect(editor.slides[0]?.animations ?? []).toHaveLength(0);
	});

	it('reveals the inspector from Effect Options, Trigger and Animation Panel', () => {
		const chromeUi = new ChromeUiState();
		chromeUi.inspectorOpen = false;
		const target = mountTab(makeEditor(), chromeUi);
		control(target, 'animations.animation.effectOptions').click();
		flushSync();

		expect(chromeUi.inspectorOpen).toBeTruthy();
		expect(chromeUi.inspectorTab).toBe('properties');
		expect(
			control(target, 'animations.advancedAnimation.animationPane').getAttribute('aria-pressed'),
		).toBe('true');
	});
});
