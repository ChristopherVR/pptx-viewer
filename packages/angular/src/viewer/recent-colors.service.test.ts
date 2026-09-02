/**
 * recent-colors.service.test.ts: the "Recent colours" row (wave-4 B6).
 *
 * Seeds from a deck's `p:clrMru`, and every pick both re-orders the in-memory
 * row AND writes the patch back into `LoadContentService.presentationProperties`
 * (outside `EditorStateService`'s undo history: this is picker chrome, not a
 * document edit).
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';
import { RecentColorsService } from './recent-colors.service';

function createService(): { recentColors: RecentColorsService; loader: LoadContentService } {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = { onDestroy: () => () => {} };
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: destroyRefStub },
			{ provide: LoadContentService, useClass: LoadContentService },
			{ provide: RecentColorsService, useClass: RecentColorsService },
		],
	});
	return {
		loader: runInInjectionContext(injector, () => injector.get(LoadContentService)),
		recentColors: runInInjectionContext(injector, () => injector.get(RecentColorsService)),
	};
}

describe('recentColorsService', () => {
	it('seeds the row from the deck mruColors', () => {
		const { recentColors } = createService();
		recentColors.seed({ mruColors: ['#112233'] });
		expect(recentColors.recent()).toStrictEqual(['#112233']);
	});

	it('picking a colour puts it first and writes mruColors back', () => {
		const { recentColors, loader } = createService();
		recentColors.seed({ mruColors: ['#112233'] });
		recentColors.push('#445566');
		expect(recentColors.recent()).toStrictEqual(['#445566', '#112233']);
		expect(loader.presentationProperties().mruColors).toStrictEqual(['#445566', '#112233']);
	});

	it('re-picking an existing recent colour re-promotes it rather than duplicating it', () => {
		const { recentColors } = createService();
		recentColors.seed({ mruColors: ['#111111', '#222222'] });
		recentColors.push('#222222');
		expect(recentColors.recent()).toStrictEqual(['#222222', '#111111']);
	});

	it('ignores a colour that is not a plain 6-digit hex', () => {
		const { recentColors } = createService();
		recentColors.seed({ mruColors: [] });
		recentColors.push('rgb(1,2,3)');
		expect(recentColors.recent()).toStrictEqual([]);
	});
});
