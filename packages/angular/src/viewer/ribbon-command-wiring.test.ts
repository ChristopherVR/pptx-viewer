import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { RibbonComponent } from './ribbon.component';
import { resolveRehearsalStartIndex } from './viewer-presentation-mode.service';

function createRibbon(): RibbonComponent {
	return runInInjectionContext(Injector.create({ providers: [] }), () => new RibbonComponent());
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
});
