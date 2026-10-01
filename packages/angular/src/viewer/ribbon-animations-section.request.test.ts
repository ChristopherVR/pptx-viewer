/**
 * The Animations tab's adapter wiring: the shared `pptx-ui-ribbon-animations`
 * view emits typed intents, and this component applies them natively through
 * the editor service (document mutation and history stay Angular's).
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly with stubbed inputs and its protected request handler is driven
 * with the same CustomEvent shape the shared element dispatches.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import {
	DEFAULT_MOTION_PATH_PRESET_ID,
	MOTION_PATH_FAMILIES,
	MOTION_PATH_PRESETS,
	motionPathFor,
	motionPathPresetById,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { MOTION_PATH_COLUMNS } from './motion-path-columns';
import { RibbonAnimationsSectionComponent } from './ribbon-animations-section.component';

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements } as PptxSlide;
}

const SHAPE = { id: 'shape-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;

/** The protected members the animations-section template binds to. */
interface AnimationsSectionInternals {
	request: (event: Event) => void;
	view: () => { editable: boolean; hasSelection: boolean; paneOpen: boolean };
	openAnimationPanel: { emit: () => void };
}

function createSection(
	editor: EditorStateService,
	overrides: Record<string, unknown> = {},
): AnimationsSectionInternals {
	const component = runInInjectionContext(
		Injector.create({ providers: [{ provide: EditorStateService, useValue: editor }] }),
		() => new RibbonAnimationsSectionComponent(),
	);
	// The section reads its selection and permission from inputs; a plain `new`
	// leaves those at their defaults, so they are replaced with stubs here.
	Object.assign(component, {
		canEdit: () => true,
		selectedElement: () => SHAPE,
		slideIndex: () => 0,
		inspectorOpen: () => false,
		...overrides,
	});
	return component as unknown as AnimationsSectionInternals;
}

function intent(detail: unknown): Event {
	return new CustomEvent('animations-request', { detail });
}

function editorWith(animations?: PptxSlide['animations']): EditorStateService {
	const editor = new EditorStateService();
	editor.setSlides([{ ...slide('s1', [SHAPE]), animations } as PptxSlide]);
	editor.select(SHAPE.id);
	return editor;
}

describe('motion path columns (inspector select model)', () => {
	it('offers the whole shared catalogue, one entry per preset', () => {
		const ids = MOTION_PATH_COLUMNS.flatMap((column) => column.presets.map((p) => p.id));
		expect(ids).toStrictEqual(MOTION_PATH_PRESETS.map((preset) => preset.id));
	});

	it("groups the paths under PowerPoint's five families, in ribbon order", () => {
		expect(MOTION_PATH_COLUMNS.map((column) => column.family)).toStrictEqual([
			...MOTION_PATH_FAMILIES,
		]);
		for (const column of MOTION_PATH_COLUMNS) {
			expect(column.presets.length).toBeGreaterThan(0);
			for (const preset of column.presets) {
				expect(preset.labelKey).toBe(`pptx.animation.motionPath.preset.${preset.id}`);
			}
		}
	});
});

describe('animations section request routing', () => {
	it('applies the picked catalogue path to the selected element', () => {
		const editor = editorWith();
		createSection(editor).request(intent({ kind: 'add', group: 'motionPath', preset: 'arcUp' }));
		const animations = editor.slides()[0].animations ?? [];
		expect(motionPathFor(animations, SHAPE.id)).toBe(motionPathPresetById('arcUp')?.path);
	});

	it('applies a path, not a Fly In entrance, for the default Path Animation intent', () => {
		const editor = editorWith();
		createSection(editor).request(
			intent({ kind: 'add', group: 'motionPath', preset: DEFAULT_MOTION_PATH_PRESET_ID }),
		);
		const entry = (editor.slides()[0].animations ?? [])[0];
		expect(entry.motionPath).toBe(motionPathPresetById(DEFAULT_MOTION_PATH_PRESET_ID)?.path);
		expect(entry.entrance).toBeUndefined();
	});

	it('leaves an existing entrance alone: a path is not a fourth preset bucket', () => {
		const editor = editorWith([{ elementId: SHAPE.id, entrance: 'fadeIn', order: 0 }]);
		createSection(editor).request(intent({ kind: 'add', group: 'motionPath', preset: 'lineDown' }));
		const animations = editor.slides()[0].animations ?? [];
		expect(animations).toHaveLength(1);
		expect(animations[0].entrance).toBe('fadeIn');
		expect(animations[0].motionPath).toBe(motionPathPresetById('lineDown')?.path);
	});

	it('files each preset under its own bucket and removes it again', () => {
		const editor = editorWith();
		const section = createSection(editor);
		section.request(intent({ kind: 'add', group: 'entrance', preset: 'flyIn' }));
		section.request(intent({ kind: 'add', group: 'exit', preset: 'fadeOut' }));
		const entry = (editor.slides()[0].animations ?? [])[0];
		expect([entry.entrance, entry.exit]).toStrictEqual(['flyIn', 'fadeOut']);
		section.request(intent({ kind: 'command', value: 'remove' }));
		expect(editor.slides()[0].animations ?? []).toHaveLength(0);
	});

	it('does not mutate a read-only deck', () => {
		const editor = editorWith();
		const section = createSection(editor, { canEdit: () => false });
		section.request(intent({ kind: 'add', group: 'entrance', preset: 'appear' }));
		section.request(intent({ kind: 'command', value: 'remove' }));
		expect(editor.slides()[0].animations ?? []).toHaveLength(0);
	});

	it('opens the animation panel for the pane, effect options and trigger commands', () => {
		const section = createSection(editorWith());
		const emit = vi.spyOn(section.openAnimationPanel, 'emit');
		for (const value of ['animationPane', 'effectOptions', 'trigger']) {
			section.request(intent({ kind: 'command', value }));
		}
		expect(emit).toHaveBeenCalledTimes(3);
	});

	it('reflects the controlled selection, permission and pane state', () => {
		const section = createSection(editorWith(), { inspectorOpen: () => true });
		expect(section.view()).toMatchObject({ editable: true, hasSelection: true, paneOpen: true });
		const empty = createSection(new EditorStateService(), { canEdit: () => false });
		expect(empty.view()).toMatchObject({ editable: false, hasSelection: false, paneOpen: false });
	});
});
