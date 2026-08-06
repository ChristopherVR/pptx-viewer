/**
 * The File > Options store is the first real consumer of the shared
 * selectively-subscribable runtime, so these assert what that buys: a consumer
 * that reads one option is no longer woken by an unrelated option changing, and
 * a multi-field write is one notification rather than one per field (#145).
 *
 * `persist: false` throughout: these are about notification behaviour, not
 * localStorage.
 */
import { describe, it, expect, vi } from 'vitest';

import { sameArray } from '../state-equality';
import { createViewerOptionsStore } from './viewer-options-store';

describe('viewer options selective subscription', () => {
	it('does not wake a ribbon subscriber when an unrelated group changes', () => {
		const store = createViewerOptionsStore({ persist: false });
		const onRibbon = vi.fn();
		store.subscribeSelector((options) => options.ribbon.hiddenTabIds, onRibbon, sameArray);

		store.setValue('advanced', 'slideShowEndWithBlackSlide', false);

		expect(onRibbon).not.toHaveBeenCalled();
		// The plain subscriber still sees it: selectivity is opt-in, not a
		// behaviour change for existing consumers.
		const onAny = vi.fn();
		store.subscribe(onAny);
		store.setValue('advanced', 'slideShowEndWithBlackSlide', true);
		expect(onAny).toHaveBeenCalledOnce();
	});

	it('wakes a ribbon subscriber when its own slice changes', () => {
		const store = createViewerOptionsStore({ persist: false });
		const onRibbon = vi.fn();
		store.subscribeSelector((options) => options.ribbon.hiddenTabIds, onRibbon, sameArray);

		store.setRibbonTabHidden('insert', true);

		expect(onRibbon).toHaveBeenCalledOnce();
		expect(onRibbon.mock.calls[0]?.[0]).toContain('insert');
	});

	it('collapses a batch of writes into a single notification', () => {
		const store = createViewerOptionsStore({ persist: false });
		const onAny = vi.fn();
		store.subscribe(onAny);

		store.batch(() => {
			store.setRibbonTabHidden('insert', true);
			store.setRibbonTabHidden('design', true);
			store.setQuickAccessCommands(['save', 'undo']);
		});

		expect(onAny).toHaveBeenCalledOnce();
		expect(store.getOptions().ribbon.hiddenTabIds).toStrictEqual(['insert', 'design']);
		expect(store.getOptions().quickAccess.commandIds).toStrictEqual(['save', 'undo']);
	});

	it('keeps a selector quiet when a batch does not touch its slice', () => {
		const store = createViewerOptionsStore({ persist: false });
		const onRibbon = vi.fn();
		store.subscribeSelector((options) => options.ribbon.hiddenTabIds, onRibbon, sameArray);

		store.batch(() => {
			store.setValue('advanced', 'slideShowEndWithBlackSlide', false);
			store.setQuickAccessCommands(['save']);
		});

		expect(onRibbon).not.toHaveBeenCalled();
	});

	it('stops notifying a selector after unsubscribe', () => {
		const store = createViewerOptionsStore({ persist: false });
		const onRibbon = vi.fn();
		const unsubscribe = store.subscribeSelector(
			(options) => options.ribbon.hiddenTabIds,
			onRibbon,
			sameArray,
		);
		unsubscribe();

		store.setRibbonTabHidden('insert', true);

		expect(onRibbon).not.toHaveBeenCalled();
	});
});
