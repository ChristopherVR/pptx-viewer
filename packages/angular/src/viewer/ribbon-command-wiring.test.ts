import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { canAuthorAnimation } from './ribbon-animations-section.component';
import { RibbonFileSectionComponent } from './ribbon-file-section.component';
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
