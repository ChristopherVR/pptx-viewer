import { MOTION_PATH_PRESETS, motionPathPresetById } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import AnimationsTab from './AnimationsTab.svelte';
import MotionPathGallery from './MotionPathGallery.svelte';

/**
 * MotionPathGallery tests: the Animations tab's motion-path gallery.
 *
 * The accessible names are asserted against the shared catalogue rather than a
 * hand-written list, because an e2e spec diffs every binding's gallery against
 * React's character for character: a typo in a label here is a cross-binding
 * parity break, not a cosmetic one.
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

function mountGallery(disabled: boolean, onapply?: (presetId: string) => void): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(MotionPathGallery, { target, props: { disabled, onapply } });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}

describe('motionPathGallery', () => {
	it('names the container with the shared gallery aria key', () => {
		const container = mountGallery(false).querySelector('[aria-label]');
		expect(container?.getAttribute('aria-label')).toBe(
			'Motion Paths: Lines, Arcs, Turns, Shapes, and Loops',
		);
	});

	it('lists every family column in ribbon order', () => {
		const labels = [...mountGallery(false).querySelectorAll('span')]
			.map((span) => span.textContent?.trim())
			.filter((text) => ['Lines', 'Arcs', 'Turns', 'Shapes', 'Loops'].includes(text ?? ''));
		expect(labels).toStrictEqual(['Lines', 'Arcs', 'Turns', 'Shapes', 'Loops']);
	});

	it('offers one real button per catalogue preset, named as React names it', () => {
		const buttons = [...mountGallery(false).querySelectorAll('button')];
		expect(buttons).toHaveLength(MOTION_PATH_PRESETS.length);
		// A representative sample across all five families.
		const expected = new Map([
			['lineRight', 'Right'],
			['arcUp', 'Arc Up'],
			['turnLeft', 'Turn Left'],
			['circle', 'Circle'],
			['figureEight', 'Figure 8'],
		]);
		const names = buttons.map((button) => button.textContent?.trim());
		for (const label of expected.values()) {
			expect(names, `${label} is missing from the gallery`).toContain(label);
		}
		// Title and visible text must agree: React sets both to the same label.
		for (const button of buttons) {
			expect(button.getAttribute('title')).toBe(button.textContent?.trim());
		}
	});

	it('reports the clicked preset id', () => {
		const seen: string[] = [];
		const target = mountGallery(false, (id) => seen.push(id));
		const right = [...target.querySelectorAll('button')].find(
			(button) => button.getAttribute('title') === 'Right',
		);
		right?.click();
		flushSync();
		expect(seen).toStrictEqual(['lineRight']);
	});

	it('disables every button without a selection', () => {
		const buttons = [...mountGallery(true).querySelectorAll('button')];
		expect(buttons.every((button) => button.disabled)).toBeTruthy();
	});

	it('writes the preset path onto the slide from the Animations tab', () => {
		const editor = makeEditor();
		const target = document.createElement('div');
		const instance = mount(AnimationsTab, { target, props: { editor } });
		flushSync();
		cleanup = () => unmount(instance);

		const arcUp = [...target.querySelectorAll('button')].find(
			(button) => button.getAttribute('title') === 'Arc Up',
		);
		expect(arcUp, 'the Animations tab must render the motion-path gallery').toBeDefined();
		arcUp?.click();
		flushSync();

		expect(editor.slides[0]?.animations?.[0]).toMatchObject({
			elementId: 'text-1',
			motionPath: motionPathPresetById('arcUp')?.path,
			motionPathEditMode: 'relative',
		});
	});

	it('gives the gallery its own ribbon group, labelled Motion Paths', () => {
		const editor = makeEditor();
		const target = document.createElement('div');
		const instance = mount(AnimationsTab, { target, props: { editor } });
		flushSync();
		cleanup = () => unmount(instance);

		expect(target.querySelector('section[aria-label="Motion Paths"]')).not.toBeNull();
	});
});
