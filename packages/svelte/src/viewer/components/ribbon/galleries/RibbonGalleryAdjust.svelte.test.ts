import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { THEME_PRESETS } from 'pptx-viewer-core';
import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
import type { RibbonGalleryPlacement } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { EditorState } from '../../../editor/editor-state.svelte';
import ContextualTab from './ContextualTab.svelte';
import { createRibbonGalleryHost, ribbonGalleryHostContext } from './ribbon-gallery-host';
import RibbonGallery from './RibbonGallery.svelte';

/**
 * Picture Format > Adjust: the Corrections, Color and Artistic Effects
 * dropdown galleries over a real picture, through the real shared galleries
 * and the editor's undoable element patch.
 */
let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function picture(): PptxElement {
	return {
		id: 'pic-1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeStyle: {},
	} as unknown as PptxElement;
}

function makeEditor(): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.theme = {
		name: 'Office',
		colorScheme: THEME_PRESETS[0].colorScheme,
		fontScheme: THEME_PRESETS[0].fontScheme,
	};
	editor.setSlides([{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [picture()] }]);
	editor.select('pic-1');
	return editor;
}

function mountComponent(
	editor: EditorState,
	component: typeof RibbonGallery | typeof ContextualTab,
	props: Record<string, unknown>,
): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(component as typeof RibbonGallery, {
		target,
		props: props as { placement: RibbonGalleryPlacement },
		context: ribbonGalleryHostContext(createRibbonGalleryHost(editor)),
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

const ADJUST = CONTEXTUAL_TAB_GROUPS.pictureFormat.find((g) => g.group === 'pictureFormat.adjust');
const placementFor = (gallery: string): RibbonGalleryPlacement =>
	ADJUST?.galleries.find((p) => p.gallery === gallery) as RibbonGalleryPlacement;

function effectsOf(editor: EditorState): PptxImageEffects | undefined {
	return (editor.slides[0].elements[0] as { imageEffects?: PptxImageEffects }).imageEffects;
}

describe('picture adjust galleries', () => {
	it('mounts the Adjust group on the Picture Format tab', () => {
		const target = mountComponent(makeEditor(), ContextualTab, { tab: 'pictureFormat' });
		expect(target.querySelector('[data-ribbon-group="pictureFormat.adjust"]')).not.toBeNull();
		for (const gallery of ['pictureCorrections', 'pictureColor', 'pictureArtisticEffects']) {
			expect(target.querySelector(`[data-ribbon-gallery="${gallery}"]`)).not.toBeNull();
		}
	});

	it.each([
		['pictureCorrections', 'soften50', 'sharpenSoften', { amount: -50000 }],
		['pictureColor', 'saturation200', 'colorSaturation', { sat: 200000 }],
		['pictureColor', 'recolorGrayscale', 'grayscale', true],
		['pictureArtisticEffects', 'paintStrokes', 'artisticEffect', 'paintStrokes'],
	] as const)(
		'%s pick %s updates imageEffects.%s and marks the tile',
		(gallery, item, key, value) => {
			const editor = makeEditor();
			const target = mountComponent(editor, RibbonGallery, { placement: placementFor(gallery) });
			const trigger = target.querySelector<HTMLButtonElement>(`[data-ribbon-gallery="${gallery}"]`);
			expect(trigger?.disabled).toBeFalsy();
			trigger?.click();
			flushSync();
			const popup = target.querySelector(`[data-ribbon-gallery-popup="${gallery}"]`);
			expect(popup?.querySelector('svg')).not.toBeNull();
			popup?.querySelector<HTMLButtonElement>(`[data-gallery-item="${item}"]`)?.click();
			flushSync();
			expect(effectsOf(editor)?.[key as keyof PptxImageEffects]).toStrictEqual(value);
			expect(editor.canUndo).toBeTruthy();
			target.querySelector<HTMLButtonElement>(`[data-ribbon-gallery="${gallery}"]`)?.click();
			flushSync();
			expect(
				target.querySelector(`[data-gallery-item="${item}"]`)?.getAttribute('aria-pressed'),
			).toBe('true');
			editor.undo();
			expect(effectsOf(editor)?.[key as keyof PptxImageEffects]).toBeUndefined();
		},
	);
});
