import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { canAuthorAnimation } from './ribbon-animations-section.component';
import { RibbonContentComponent } from './ribbon-content.component';
import { RibbonFileSectionComponent } from './ribbon-file-section.component';
import {
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	strokeWidthOf,
} from './ribbon-shape-extras.component';
import { RibbonSlideshowSectionComponent } from './ribbon-slideshow-section.component';
import { RibbonViewSectionComponent } from './ribbon-view-section.component';
import { RibbonComponent } from './ribbon.component';
import { centeredGuide, RulerGuidesService } from './ruler-guides.service';
import { resolveRehearsalStartIndex } from './viewer-presentation-mode.service';

function createRibbon(): RibbonComponent {
	return runInInjectionContext(Injector.create({ providers: [] }), () => new RibbonComponent());
}

function createFileSection(): RibbonFileSectionComponent {
	return runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new RibbonFileSectionComponent(),
	);
}

describe('angular ribbon command behavior', () => {
	it('starts a beginning recording on slide zero', () => {
		expect(resolveRehearsalStartIndex('beginning', 4, 8)).toBe(0);
	});

	it('starts a current-slide recording on the active slide', () => {
		expect(resolveRehearsalStartIndex('current', 4, 8)).toBe(4);
	});

	it('clamps a stale current-slide index to the deck', () => {
		expect(resolveRehearsalStartIndex('current', 12, 3)).toBe(2);
		expect(resolveRehearsalStartIndex('current', -1, 3)).toBe(0);
	});

	it('uses slide zero for an empty deck without producing an invalid index', () => {
		expect(resolveRehearsalStartIndex('current', 2, 0)).toBe(0);
	});

	it('routes File Options and Review Language through the Settings output', () => {
		const ribbon = createRibbon();
		let opened = 0;
		ribbon.openSettings.subscribe(() => opened++);

		(
			ribbon as unknown as {
				requestSettings: () => void;
			}
		).requestSettings();
		(
			ribbon as unknown as {
				requestSettings: () => void;
			}
		).requestSettings();

		expect(opened).toBe(2);
	});

	it('forwards the Review spell command to viewer-owned state', () => {
		const ribbon = createRibbon();
		const values: boolean[] = [];
		ribbon.spellCheckChange.subscribe((enabled) => values.push(enabled));

		(
			ribbon as unknown as {
				setSpellCheck: (enabled: boolean) => void;
			}
		).setSpellCheck(true);
		(
			ribbon as unknown as {
				setSpellCheck: (enabled: boolean) => void;
			}
		).setSpellCheck(false);

		expect(values).toStrictEqual([true, false]);
	});

	it('opens Settings immediately when File Options is selected', () => {
		const file = createFileSection();
		let options = 0;
		let closes = 0;
		file.options.subscribe(() => options++);
		file.close.subscribe(() => closes++);

		(file as unknown as { selectPage: (id: 'options') => void }).selectPage('options');

		expect(options).toBe(1);
		expect(closes).toBe(1);
	});

	it('creates horizontal and vertical guides at the slide center', () => {
		expect(centeredGuide('x', { width: 960, height: 540 }, 'v')).toStrictEqual({
			id: 'v',
			axis: 'x',
			pos: 480,
		});
		expect(centeredGuide('y', { width: 960, height: 540 }, 'h')).toStrictEqual({
			id: 'h',
			axis: 'y',
			pos: 270,
		});
	});

	it('adds toolbar guides only when the canvas is editable', () => {
		let editable = false;
		const guides = new RulerGuidesService();
		guides.bind({
			editable: () => editable,
			stageElement: () => undefined,
			effectiveScale: () => 1,
			canvasSize: () => ({ width: 960, height: 540 }),
		});

		guides.addGuide('x');
		expect(guides.rulerGuides()).toHaveLength(0);
		editable = true;
		guides.addGuide('y');
		expect(guides.rulerGuides()).toHaveLength(1);
		expect(guides.rulerGuides()[0]).toMatchObject({ axis: 'y', pos: 270 });
	});

	it('gates every ribbon animation mutation on edit permission and selection', () => {
		expect(canAuthorAnimation(true, true)).toBeTruthy();
		expect(canAuthorAnimation(false, true)).toBeFalsy();
		expect(canAuthorAnimation(true, false)).toBeFalsy();
	});
});

/**
 * The Arrange group's shape extras, gated the way every other binding gates
 * them. These rules are the whole behaviour of the three controls, so pinning
 * them here is cheaper than a browser and catches the porting mistake that
 * matters: a control that renders but is live (or dead) at the wrong moment.
 */
describe('arrange group shape extras', () => {
	const group = { type: 'group', id: 'g1' } as PptxElement;
	const shape = { type: 'shape', id: 's1' } as PptxElement;
	const chart = { type: 'chart', id: 'c1' } as PptxElement;

	it('needs two elements and an editable deck before it will group', () => {
		expect(canGroupSelection(true, 2)).toBeTruthy();
		expect(canGroupSelection(true, 5)).toBeTruthy();
		expect(canGroupSelection(true, 1)).toBeFalsy();
		expect(canGroupSelection(true, 0)).toBeFalsy();
		expect(canGroupSelection(false, 3)).toBeFalsy();
	});

	it('only ungroups a selection that is itself a group', () => {
		expect(canUngroupSelection(true, group)).toBeTruthy();
		expect(canUngroupSelection(true, shape)).toBeFalsy();
		expect(canUngroupSelection(true, null)).toBeFalsy();
		expect(canUngroupSelection(false, group)).toBeFalsy();
	});

	it('offers an outline width only for an element that carries shape properties', () => {
		expect(canSetStrokeWidth(true, shape)).toBeTruthy();
		expect(canSetStrokeWidth(true, chart)).toBeFalsy();
		expect(canSetStrokeWidth(true, null)).toBeFalsy();
		expect(canSetStrokeWidth(false, shape)).toBeFalsy();
	});

	it('falls back to the renderer default when the shape declares no outline', () => {
		expect(strokeWidthOf(shape)).toBe(1);
		expect(strokeWidthOf({ ...shape, shapeStyle: { strokeWidth: 4.5 } } as PptxElement)).toBe(4.5);
		expect(strokeWidthOf({ ...shape, shapeStyle: { strokeWidth: 0 } } as PptxElement)).toBe(0);
		expect(strokeWidthOf(null)).toBe(1);
	});
});

/**
 * Three ribbon commands that regressed into dead chrome. Each had a real
 * implementation elsewhere in the viewer and simply no wire from the tab to it,
 * which no unit test could see because nothing asserted the wire existed.
 */
describe('restored ribbon commands', () => {
	it('re-emits the View tab shape-snapping toggle the canvas already honours', () => {
		const view = runInInjectionContext(
			Injector.create({ providers: [{ provide: EditorStateService, useValue: null }] }),
			() => new RibbonViewSectionComponent(),
		);
		let toggles = 0;
		view.toggleSnapToShape.subscribe(() => toggles++);

		view.toggleSnapToShape.emit();
		view.toggleSnapToShape.emit();

		expect(toggles).toBe(2);
	});

	it('opens the custom-show manager from the Slide Show tab', () => {
		const section = runInInjectionContext(
			Injector.create({ providers: [] }),
			() => new RibbonSlideshowSectionComponent(),
		);
		let opened = 0;
		section.openCustomShows.subscribe(() => opened++);

		section.openCustomShows.emit();

		expect(opened).toBe(1);
	});

	it('routes the Insert tab hyperlink command through the ribbon link output', () => {
		const content = runInInjectionContext(
			Injector.create({ providers: [] }),
			() => new RibbonContentComponent(),
		);
		let links = 0;
		content.link.subscribe(() => links++);

		content.link.emit();

		expect(links).toBe(1);
	});
});
