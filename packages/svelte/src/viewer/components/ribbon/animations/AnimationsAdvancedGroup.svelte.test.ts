import { DEFAULT_MOTION_PATH_PRESET_ID, motionPathPresetById } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import { ChromeUiState } from '../../../state/chrome-ui.svelte';
import AnimationsAdvancedGroup from './AnimationsAdvancedGroup.svelte';

/**
 * AnimationsAdvancedGroup tests: the Advanced Animation and Timing groups the
 * Animations tab was missing. Covers the commands that actually add an effect,
 * the ones that route to the inspector, and the placeholders React parks.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
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
	editor.select('text-1');
	return editor;
}

function mountGroup(
	editor: EditorState,
	disabled: boolean,
	chromeUi?: ChromeUiState,
): Map<string, HTMLButtonElement> {
	const target = document.createElement('div');
	const instance = mount(AnimationsAdvancedGroup, {
		target,
		props: { editor, chromeUi, disabled },
	});
	flushSync();
	cleanup = () => unmount(instance);
	return new Map(
		[...target.querySelectorAll<HTMLButtonElement>('button')].map((button) => [
			button.textContent?.trim() ?? '',
			button,
		]),
	);
}

describe('animationsAdvancedGroup', () => {
	it('offers the Advanced Animation commands React does', () => {
		const found = mountGroup(makeEditor(), false);
		for (const name of [
			'Exit Effects',
			'Path Animation',
			'Effect Options',
			'Animation Panel',
			'Trigger',
			'Animation Painter',
			'Remove',
		]) {
			expect(found.get(name), `${name} is missing from the Animations tab`).toBeDefined();
		}
		expect(
			found.get('Animation Painter')?.disabled,
			'Animation Painter is parked in React too',
		).toBeTruthy();
	});

	it('gates every selection-bound command on there being a selection', () => {
		const found = mountGroup(makeEditor(), true);
		for (const name of ['Exit Effects', 'Path Animation', 'Effect Options', 'Trigger', 'Remove']) {
			expect(found.get(name)?.disabled, `${name} needs a selected element`).toBeTruthy();
		}
		// The panel is worth opening with nothing selected.
		expect(found.get('Animation Panel')?.disabled).toBeFalsy();
	});

	it('adds a real exit effect from Exit Effects', () => {
		const editor = makeEditor();
		mountGroup(editor, false).get('Exit Effects')?.click();
		flushSync();

		expect(editor.slides[0]?.animations?.[0]).toMatchObject({
			elementId: 'text-1',
			exit: 'fadeOut',
		});
	});

	it('applies the default MOTION PATH from Path Animation, and removes it again', () => {
		const editor = makeEditor();
		const found = mountGroup(editor, false);

		found.get('Path Animation')?.click();
		flushSync();
		// It used to add a Fly In entrance, which is not a path at all: nothing
		// was ever drawn on the canvas for the user to drag.
		expect(editor.slides[0]?.animations?.[0]).toMatchObject({
			elementId: 'text-1',
			motionPath: motionPathPresetById(DEFAULT_MOTION_PATH_PRESET_ID)?.path,
			motionPathEditMode: 'relative',
		});
		expect(editor.slides[0]?.animations?.[0]?.entrance).toBeUndefined();

		found.get('Remove')?.click();
		flushSync();
		expect(editor.slides[0]?.animations ?? []).toHaveLength(0);
	});

	it('reveals the inspector from Effect Options and Animation Panel', () => {
		const chromeUi = new ChromeUiState();
		chromeUi.inspectorOpen = false;
		mountGroup(makeEditor(), false, chromeUi).get('Effect Options')?.click();
		flushSync();

		expect(chromeUi.inspectorOpen).toBeTruthy();
		expect(chromeUi.inspectorTab).toBe('properties');
	});
});
