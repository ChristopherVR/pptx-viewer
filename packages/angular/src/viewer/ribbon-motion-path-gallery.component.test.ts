/**
 * The Animations tab's motion-path gallery, Angular binding.
 *
 * What is worth proving here is what has historically rotted: that the gallery
 * offers the WHOLE shared catalogue (the preset gallery beside it once shipped
 * six of twenty-seven presets), that every path is a real, nameable <button>
 * rather than an icon behind a hover menu, and that the "Path Animation"
 * command applies a path instead of the Fly In entrance it used to apply.
 *
 * No Angular TestBed (see `vitest.config.ts`): the column model is asserted
 * directly and the template contract is read from the source, which is exactly
 * what `e2e/ribbon-control-inventory.spec.ts` diffs against React.
 *
 * Reference binding: packages/react/src/viewer/components/toolbar/MotionPathGallery.tsx
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	DEFAULT_MOTION_PATH_PRESET_ID,
	MOTION_PATH_FAMILIES,
	MOTION_PATH_PRESETS,
	motionPathFor,
	motionPathPresetById,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { RibbonAnimationsSectionComponent } from './ribbon-animations-section.component';
import { MOTION_PATH_COLUMNS } from './ribbon-motion-path-gallery.component';

const GALLERY_SOURCE = readFileSync(
	path.join(__dirname, 'ribbon-motion-path-gallery.component.ts'),
	'utf8',
);

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements } as PptxSlide;
}

const SHAPE = { id: 'shape-1', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;

/** The protected members the animations-section template binds to. */
interface AnimationsSectionInternals {
	applyMotionPath: (presetId: string) => void;
	defaultMotionPathPresetId: string;
}

function createSection(editor: EditorStateService): AnimationsSectionInternals {
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
	});
	return component as unknown as AnimationsSectionInternals;
}

describe('motion path gallery columns', () => {
	it('offers the whole shared catalogue, one entry per preset', () => {
		const ids = MOTION_PATH_COLUMNS.flatMap((column) => column.presets.map((p) => p.id));
		expect(ids).toStrictEqual(MOTION_PATH_PRESETS.map((preset) => preset.id));
	});

	it("groups the paths under PowerPoint's five families, in ribbon order", () => {
		expect(MOTION_PATH_COLUMNS.map((column) => column.family)).toStrictEqual([
			...MOTION_PATH_FAMILIES,
		]);
		expect(MOTION_PATH_COLUMNS.map((column) => column.labelKey)).toStrictEqual([
			'pptx.animation.motionPath.family.lines',
			'pptx.animation.motionPath.family.arcs',
			'pptx.animation.motionPath.family.turns',
			'pptx.animation.motionPath.family.shapes',
			'pptx.animation.motionPath.family.loops',
		]);
	});

	it('names every path by its shared i18n key', () => {
		for (const column of MOTION_PATH_COLUMNS) {
			for (const preset of column.presets) {
				expect(preset.labelKey).toBe(`pptx.animation.motionPath.preset.${preset.id}`);
			}
		}
	});

	it('leaves no family empty', () => {
		expect(MOTION_PATH_COLUMNS.every((column) => column.presets.length > 0)).toBeTruthy();
	});
});

describe('motion path gallery template contract', () => {
	it('renders each path as a real button carrying its name as title and text', () => {
		expect(GALLERY_SOURCE).toContain('<button');
		expect(GALLERY_SOURCE).toContain('[title]="preset.labelKey | translate"');
		expect(GALLERY_SOURCE).toContain('{{ preset.labelKey | translate }}');
	});

	it('names the gallery for assistive technology', () => {
		expect(GALLERY_SOURCE).toContain('role="group"');
		expect(GALLERY_SOURCE).toContain(
			`[attr.aria-label]="'pptx.animations.motionPathGalleryAria' | translate"`,
		);
	});

	it('disables every button when nothing is selected', () => {
		expect(GALLERY_SOURCE).toContain('[disabled]="disabled()"');
	});

	it('emits the picked preset id', () => {
		expect(GALLERY_SOURCE).toContain('(click)="applyMotionPath.emit(preset.id)"');
	});
});

describe('animations section motion-path wiring', () => {
	it('applies the picked catalogue path to the selected element', () => {
		const editor = new EditorStateService();
		editor.setSlides([slide('s1', [SHAPE])]);
		createSection(editor).applyMotionPath('arcUp');

		const animations = editor.slides()[0].animations ?? [];
		expect(motionPathFor(animations, SHAPE.id)).toBe(motionPathPresetById('arcUp')?.path);
	});

	it('applies a path, not a Fly In entrance, for the Path Animation command', () => {
		const editor = new EditorStateService();
		editor.setSlides([slide('s1', [SHAPE])]);
		const section = createSection(editor);
		section.applyMotionPath(section.defaultMotionPathPresetId);

		const entry = (editor.slides()[0].animations ?? [])[0];
		expect(section.defaultMotionPathPresetId).toBe(DEFAULT_MOTION_PATH_PRESET_ID);
		expect(entry.motionPath).toBe(motionPathPresetById(DEFAULT_MOTION_PATH_PRESET_ID)?.path);
		expect(entry.entrance).toBeUndefined();
	});

	it('leaves an existing entrance alone: a path is not a fourth preset bucket', () => {
		const editor = new EditorStateService();
		editor.setSlides([
			{
				...slide('s1', [SHAPE]),
				animations: [{ elementId: SHAPE.id, entrance: 'fadeIn', order: 0 }],
			} as PptxSlide,
		]);
		createSection(editor).applyMotionPath('lineDown');

		const animations = editor.slides()[0].animations ?? [];
		expect(animations).toHaveLength(1);
		expect(animations[0].entrance).toBe('fadeIn');
		expect(animations[0].motionPath).toBe(motionPathPresetById('lineDown')?.path);
	});
});
