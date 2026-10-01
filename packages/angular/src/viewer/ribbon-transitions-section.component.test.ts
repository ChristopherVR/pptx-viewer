/**
 * ribbon-transitions-section.component.test.ts: pins that every control on the
 * Transitions tab reaches the deck through the shared view's typed intents.
 *
 * Before this wiring the tab committed only the preset and the duration (with a
 * hard-coded `advanceOnClick: true`), while the Advance Slide checkboxes and the
 * seconds field wrote component-local signals nothing read, so a timed advance
 * picked in the ribbon never existed anywhere but the checkbox.
 *
 * No TestBed (matching the rest of this package): the component is constructed
 * inside a plain `Injector` context and its protected `request` handler is
 * invoked with the same CustomEvent the shared `pptx-ui-ribbon-transitions`
 * element dispatches.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import {
	EFFECT_SOUND_CATALOGUE,
	TRANSITION_PREVIEW_ATTR,
	transitionSoundOptions,
} from '../internal/shared';
import type { RibbonTransitionsIntent } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { RibbonTransitionsSectionComponent } from './ribbon-transitions-section.component';

const STOCK_IDS = EFFECT_SOUND_CATALOGUE.map((entry) => entry.id);

/** The protected surface the template binds to. */
interface TransitionsControls {
	request: (event: Event) => void;
	view: () => {
		draft: { type: string; durationSec: number; advanceAfter: boolean };
		editable: boolean;
		transition?: unknown;
	};
}

function slide(id: string): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

function harness(slideCount = 2) {
	const editor = new EditorStateService();
	editor.setSlides(Array.from({ length: slideCount }, (_, index) => slide(`s${index + 1}`)));
	const injector = Injector.create({
		providers: [{ provide: EditorStateService, useValue: editor }],
	});
	const section = runInInjectionContext(injector, () => new RibbonTransitionsSectionComponent());
	const controls = section as unknown as TransitionsControls;
	const request = (intent: RibbonTransitionsIntent) =>
		controls.request(new CustomEvent('transitions-request', { detail: intent }));
	return { editor, controls, section, request };
}

/** Poll until `predicate` is true, rather than hoping a fixed delay covers
 * the FileReader read (its completion time is not guaranteed under load). */
async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!predicate()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: condition not met before deadline');
		}
		await new Promise((resolve) => {
			setTimeout(resolve, 5);
		});
	}
}

describe('transitions ribbon tab', () => {
	it('derives the view state from the active slide', () => {
		const { editor, controls } = harness();
		expect(controls.view().draft.type).toBe('none');
		editor.updateSlide(0, { transition: { type: 'reveal', durationMs: 900 } });
		expect(controls.view()).toMatchObject({
			draft: { type: 'reveal', durationSec: 0.9 },
			editable: true,
		});
	});

	it('writes the picked preset onto the active slide only', () => {
		const { editor, request } = harness();
		request({ kind: 'preset', value: 'fade' });
		expect(editor.slides()[0].transition).toMatchObject({ type: 'fade' });
		expect(editor.slides()[1].transition).toBeUndefined();
	});

	it('commits the duration in milliseconds without dropping the preset', () => {
		const { editor, request } = harness();
		request({ kind: 'preset', value: 'push' });
		request({ kind: 'duration', value: 1.25 });
		expect(editor.slides()[0].transition).toMatchObject({ type: 'push', durationMs: 1250 });
	});

	it('commits the Advance Slide on-mouse-click toggle', () => {
		const { editor, request } = harness();
		request({ kind: 'preset', value: 'wipe' });
		request({ kind: 'advanceOnClick', value: false });
		expect(editor.slides()[0].transition).toMatchObject({ advanceOnClick: false });
	});

	it('commits a timed advance from the After field, and clears it when unticked', () => {
		const { editor, controls, request } = harness();
		request({ kind: 'advanceAfter', value: true });
		request({ kind: 'advanceAfterText', value: '00:03.50' });
		expect(editor.slides()[0].transition).toMatchObject({ advanceAfterMs: 3500 });
		expect(controls.view().draft.advanceAfter).toBeTruthy();
		request({ kind: 'advanceAfter', value: false });
		expect(editor.slides()[0].transition?.advanceAfterMs).toBeUndefined();
	});

	it('applies the current draft to every slide on Apply to All', () => {
		const { editor, request } = harness(3);
		request({ kind: 'preset', value: 'cover' });
		request({ kind: 'duration', value: 0.4 });
		request({ kind: 'applyToAll' });
		for (const item of editor.slides()) {
			expect(item.transition).toMatchObject({ type: 'cover', durationMs: 400 });
		}
	});

	it('previews by replaying the transition on the stage, not by starting the show', () => {
		const { editor, request } = harness();
		const stage = document.createElement('div');
		stage.setAttribute('aria-roledescription', 'slide');
		document.body.appendChild(stage);
		request({ kind: 'preset', value: 'push' });
		request({ kind: 'preview' });
		expect(stage.getAttribute(TRANSITION_PREVIEW_ATTR)).toBe('push');
		// A preview is not an edit, and it is not a slide show either.
		expect(editor.slides()[0].transition).toMatchObject({ type: 'push' });
		stage.remove();
	});

	it('emits the Inspector toggle without touching the deck', () => {
		const { editor, section, request } = harness();
		const toggled = vi.fn();
		section.toggleInspector.subscribe(toggled);
		request({ kind: 'inspector' });
		expect(toggled).toHaveBeenCalledOnce();
		expect(editor.slides()[0].transition).toBeUndefined();
	});

	it('refuses edits when the host is read-only', () => {
		const { editor, section, request } = harness();
		(section as unknown as { canEdit: () => boolean }).canEdit = () => false;
		request({ kind: 'preset', value: 'fade' });
		request({ kind: 'applyToAll' });
		expect(editor.slides().every((item) => item.transition === undefined)).toBeTruthy();
	});
});

describe('transitions ribbon tab > Sound picker', () => {
	it('offers None, all 19 stock sounds, and Other Sound for a slide with no sound', () => {
		const { controls } = harness();
		const options = transitionSoundOptions(controls.view().transition as undefined);
		expect(options.map((option) => option.value)).toStrictEqual(['none', ...STOCK_IDS, 'other']);
	});

	it('picks a stock sound directly, with no file dialog', async () => {
		const { editor, request } = harness();
		editor.updateSlide(0, { transition: { type: 'fade' } });
		request({ kind: 'sound', value: 'chime' });
		await waitFor(() => editor.slides()[0].transition?.soundData !== undefined);
		expect(editor.slides()[0].transition).toMatchObject({
			type: 'fade',
			soundName: 'CHIMES.WAV',
			soundFileName: 'CHIMES.WAV',
		});
		expect(editor.slides()[0].transition?.soundData).toMatch(/^data:audio\/wav;base64,/);
	});

	it('clears the sound when "None" is chosen', async () => {
		const { editor, request } = harness();
		editor.updateSlide(0, {
			transition: { type: 'fade', soundFileName: 'chime.wav', soundRId: 'rId2' },
		});
		request({ kind: 'sound', value: 'none' });
		await waitFor(() => editor.slides()[0].transition?.soundFileName === undefined);
		expect(editor.slides()[0].transition).toMatchObject({
			type: 'fade',
			soundRId: undefined,
			soundFileName: undefined,
		});
	});

	it('commits the picked file as pending sound data', async () => {
		const { editor, request } = harness();
		editor.updateSlide(0, { transition: { type: 'fade' } });
		const file = new File(['fake wav bytes'], 'applause.wav', { type: 'audio/wav' });
		request({ kind: 'soundFile', file });
		// FileReader resolves asynchronously even for an in-memory Blob; poll
		// rather than hope a fixed delay covers it under load.
		await waitFor(() => editor.slides()[0].transition?.soundData !== undefined);
		expect(editor.slides()[0].transition).toMatchObject({
			type: 'fade',
			soundFileName: 'applause.wav',
			soundName: 'applause',
			soundRId: undefined,
			soundPath: undefined,
		});
		expect(editor.slides()[0].transition?.soundData).toMatch(/^data:/);
	});
});
