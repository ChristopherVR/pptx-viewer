import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { RibbonFileSectionComponent, visibleMainNav } from './ribbon-file-section.component';

/** The protected template surface the backstage cards render from. */
interface FileSectionInternals {
	page: { set: (id: 'export') => void };
	actions: () => readonly { titleKey: string; icon: string; event: { emit: () => void } }[];
	run: (event: { emit: () => void }) => void;
}

function createFileSection(): RibbonFileSectionComponent {
	return runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new RibbonFileSectionComponent(),
	);
}

describe('visibleMainNav', () => {
	it('includes the Export entry when hiddenActions is omitted (backward-compatible default)', () => {
		const ids = visibleMainNav(undefined).map((item) => item.id);
		expect(ids).toContain('export');
	});

	it('drops the Export entry when "export" is hidden, leaving unrelated entries', () => {
		const ids = visibleMainNav(['export']).map((item) => item.id);
		expect(ids).not.toContain('export');
		expect(ids).toContain('home');
		expect(ids).toContain('save');
	});

	it('leaves the Export entry when an unrelated action is hidden', () => {
		const ids = visibleMainNav(['share']).map((item) => item.id);
		expect(ids).toContain('export');
	});
});

describe('export page JSON card', () => {
	it('shows the Export as JSON card on the export page', () => {
		const file = createFileSection();
		const internals = file as unknown as FileSectionInternals;
		internals.page.set('export');

		const card = internals
			.actions()
			.find((action) => action.titleKey === 'pptx.backstage.card.json.title');
		expect(card).toBeDefined();
		expect(card?.icon).toBe('{}');
	});

	it('fires exportJson (and closes the backstage) when the card is clicked', () => {
		const file = createFileSection();
		const internals = file as unknown as FileSectionInternals;
		internals.page.set('export');
		let exports = 0;
		let closes = 0;
		file.exportJson.subscribe(() => exports++);
		file.close.subscribe(() => closes++);

		const card = internals
			.actions()
			.find((action) => action.titleKey === 'pptx.backstage.card.json.title');
		expect(card).toBeDefined();
		if (card) {
			internals.run(card.event);
		}

		expect(exports).toBe(1);
		expect(closes).toBe(1);
	});
});
