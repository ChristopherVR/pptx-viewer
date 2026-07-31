import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { motionPathPresetById } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorController } from '../editor/editor-controller.svelte';
import { EditorState } from '../editor/editor-state.svelte';
import MotionPathOverlay from './MotionPathOverlay.svelte';
import SlideOverlays from './SlideOverlays.svelte';

/**
 * MotionPathOverlay tests: the dashed on-canvas path plus its draggable end
 * handle. Geometry is asserted in slide pixels (the space the overlay draws
 * in), and the drag is asserted through the committed PATH STRING rather than
 * the handle's rendered position, because the path is what survives a save.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** A 100x50 shape whose centre lands at (200, 100) in slide pixels. */
function shapeEl(): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 150,
		y: 75,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: {},
	} as PptxElement;
}

const CANVAS = { width: 1280, height: 720 };

function mountOverlay(options: {
	path: string;
	scale?: number;
	canEdit?: boolean;
	onchangepath?: (path: string) => void;
}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(MotionPathOverlay, {
		target,
		props: {
			element: shapeEl(),
			path: options.path,
			canvasSize: CANVAS,
			scale: options.scale ?? 1,
			canEdit: options.canEdit ?? true,
			onchangepath: options.onchangepath,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function handleOf(target: HTMLElement): SVGCircleElement {
	const handle = target.querySelector<SVGCircleElement>('[data-pptx-motion-path-handle="end"]');
	expect(handle, 'the overlay must draw a draggable end handle').not.toBeNull();
	// jsdom has no pointer capture on SVG elements.
	handle!.setPointerCapture = () => undefined;
	handle!.releasePointerCapture = () => undefined;
	return handle!;
}

function pointer(type: string, clientX: number, clientY: number): PointerEvent {
	return new PointerEvent(type, { pointerId: 1, clientX, clientY, bubbles: true });
}

describe('motionPathOverlay', () => {
	it('draws the shared DOM contract the other bindings draw', () => {
		const target = mountOverlay({ path: 'M 0 0 L 0.25 0' });
		const svg = target.querySelector('[data-pptx-motion-path-overlay="true"]');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('role')).toBe('img');
		expect(svg?.getAttribute('aria-label')).toBe('Motion path preview');
		const path = svg?.querySelector('path');
		expect(path?.getAttribute('stroke')).toBe('#0ea5e9');
		expect(path?.getAttribute('stroke-dasharray')).toBe('6 4');
	});

	it('anchors the path at the element centre and ends a quarter-slide right', () => {
		const target = mountOverlay({ path: 'M 0 0 L 0.25 0' });
		// Centre (200, 100); 0.25 * 1280 === 320 px of travel.
		expect(target.querySelector('path')?.getAttribute('d')).toBe('M 200 100 L 200 100 L 520 100');
		const handle = handleOf(target);
		expect(handle.getAttribute('cx')).toBe('520');
		expect(handle.getAttribute('cy')).toBe('100');
	});

	it('scales the whole overlay by the editor zoom, keeping slide-pixel coordinates', () => {
		const target = mountOverlay({ path: 'M 0 0 L 0.25 0', scale: 0.5 });
		const svg = target.querySelector<SVGSVGElement>('[data-pptx-motion-path-overlay="true"]');
		expect(svg?.getAttribute('width')).toBe('1280');
		expect(svg?.getAttribute('style')).toContain('scale(0.5)');
		expect(handleOf(target).getAttribute('cx')).toBe('520');
	});

	it('renders nothing for a path it cannot trace', () => {
		expect(
			mountOverlay({ path: '' }).querySelector('[data-pptx-motion-path-overlay="true"]'),
		).toBeNull();
	});

	it('retargets the end point on drag, in slide fractions', () => {
		const commits: string[] = [];
		const target = mountOverlay({
			path: 'M 0 0 L 0.25 0',
			onchangepath: (next) => commits.push(next),
		});
		const handle = handleOf(target);
		handle.dispatchEvent(pointer('pointerdown', 520, 100));
		handle.dispatchEvent(pointer('pointermove', 648, 172));
		flushSync();

		// +128 px of 1280 === +0.1 x; +72 px of 720 === +0.1 y.
		expect(commits).toStrictEqual(['M 0 0 L 0.35 0.1']);
	});

	it('divides the pointer delta by the editor zoom', () => {
		const commits: string[] = [];
		const target = mountOverlay({
			path: 'M 0 0 L 0.25 0',
			scale: 0.5,
			onchangepath: (next) => commits.push(next),
		});
		const handle = handleOf(target);
		handle.dispatchEvent(pointer('pointerdown', 260, 50));
		// 64 screen px at 0.5 zoom is 128 slide px, i.e. the same +0.1 as above.
		handle.dispatchEvent(pointer('pointermove', 324, 50));
		flushSync();

		expect(commits).toStrictEqual(['M 0 0 L 0.35 0']);
	});

	it('stops tracking after pointerup', () => {
		const commits: string[] = [];
		const target = mountOverlay({
			path: 'M 0 0 L 0.25 0',
			onchangepath: (next) => commits.push(next),
		});
		const handle = handleOf(target);
		handle.dispatchEvent(pointer('pointerdown', 520, 100));
		handle.dispatchEvent(pointer('pointerup', 520, 100));
		handle.dispatchEvent(pointer('pointermove', 648, 100));
		flushSync();

		expect(commits).toStrictEqual([]);
	});

	it('refuses to drag a closed path, which has no free end', () => {
		const commits: string[] = [];
		const target = mountOverlay({
			path: motionPathPresetById('square')?.path ?? '',
			onchangepath: (next) => commits.push(next),
		});
		const handle = handleOf(target);
		expect(handle.classList.contains('is-editable')).toBeFalsy();
		handle.dispatchEvent(pointer('pointerdown', 200, 100));
		handle.dispatchEvent(pointer('pointermove', 400, 100));
		flushSync();

		expect(commits).toStrictEqual([]);
	});

	/**
	 * The wiring, not the drawing: the overlay only appears for the SELECTED
	 * element's own path, only while editing, and its drag commits back through
	 * the editor's undoable animation ops.
	 */
	describe('slideOverlays wiring', () => {
		function mountOverlays(options: { editingActive: boolean; select?: string }): {
			editor: EditorState;
			target: HTMLElement;
		} {
			const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
			editor.editable = true;
			editor.setSlides([
				{
					id: 's1',
					rId: 'rId1',
					slideNumber: 1,
					elements: [shapeEl(), { ...shapeEl(), id: 'shape-2' } as PptxElement],
					animations: [
						{ elementId: 'shape-1', motionPath: 'M 0 0 L 0.25 0', motionPathEditMode: 'relative' },
					],
				} as PptxSlide,
			]);
			if (options.select) {
				editor.select(options.select);
			}
			const controller = new EditorController(editor, {
				getScale: () => 1,
				getCurrent: () => 0,
				getPresenting: () => false,
				getStageRoot: () => null,
				getHolderEl: () => null,
			});

			const target = document.createElement('div');
			document.body.appendChild(target);
			const instance = mount(SlideOverlays, {
				target,
				props: {
					editor,
					controller,
					canvasSize: CANVAS,
					mediaDataUrls: new Map<string, string>(),
					current: 0,
					activeSlide: editor.slides[0],
					scale: 1,
					presenting: false,
					editingActive: options.editingActive,
				},
			});
			flushSync();
			cleanup = () => {
				unmount(instance);
				target.remove();
			};
			return { editor, target };
		}

		it('draws the selected element path while editing', () => {
			const { target } = mountOverlays({ editingActive: true, select: 'shape-1' });
			expect(target.querySelector('[data-pptx-motion-path-overlay="true"]')).not.toBeNull();
		});

		it('stays out of view mode and off unrelated selections', () => {
			expect(
				mountOverlays({ editingActive: false, select: 'shape-1' }).target.querySelector(
					'[data-pptx-motion-path-overlay="true"]',
				),
			).toBeNull();
			cleanup?.();
			cleanup = undefined;
			expect(
				mountOverlays({ editingActive: true, select: 'shape-2' }).target.querySelector(
					'[data-pptx-motion-path-overlay="true"]',
				),
			).toBeNull();
		});

		it('commits a drag onto the slide as an undoable step', () => {
			const { editor, target } = mountOverlays({ editingActive: true, select: 'shape-1' });
			const handle = handleOf(target);
			handle.dispatchEvent(pointer('pointerdown', 520, 100));
			handle.dispatchEvent(pointer('pointermove', 648, 100));
			flushSync();

			expect(editor.slides[0]?.animations?.[0]?.motionPath).toBe('M 0 0 L 0.35 0');
			editor.undo();
			expect(editor.slides[0]?.animations?.[0]?.motionPath).toBe('M 0 0 L 0.25 0');
		});
	});

	it('is read-only in a non-editable deck', () => {
		const commits: string[] = [];
		const target = mountOverlay({
			path: 'M 0 0 L 0.25 0',
			canEdit: false,
			onchangepath: (next) => commits.push(next),
		});
		const handle = handleOf(target);
		expect(handle.classList.contains('is-editable')).toBeFalsy();
		handle.dispatchEvent(pointer('pointerdown', 520, 100));
		handle.dispatchEvent(pointer('pointermove', 648, 100));
		flushSync();

		expect(commits).toStrictEqual([]);
	});
});
