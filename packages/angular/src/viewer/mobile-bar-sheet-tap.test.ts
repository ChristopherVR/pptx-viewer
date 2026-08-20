import { describe, expect, it, vi } from 'vitest';

import { applyMobileBarSheetTap } from './mobile-bar-sheet-tap';
import { toggleSheet } from './mobile-chrome-helpers';

function actionsSpy() {
	return {
		openSlides: vi.fn(),
		openInspector: vi.fn(),
		openComments: vi.fn(),
		openNotes: vi.fn(),
		closeAll: vi.fn(),
	};
}

describe('applyMobileBarSheetTap priority', () => {
	it('opens a sheet from closed', () => {
		const actions = actionsSpy();
		applyMobileBarSheetTap('slides', null, actions);
		expect(actions.closeAll).toHaveBeenCalledOnce();
		expect(actions.openSlides).toHaveBeenCalledOnce();
		expect(actions.openInspector).not.toHaveBeenCalled();
	});

	it('closes the sheet that is already open (tapping it again) without reopening it', () => {
		const actions = actionsSpy();
		applyMobileBarSheetTap('inspector', 'inspector', actions);
		expect(actions.closeAll).toHaveBeenCalledOnce();
		expect(actions.openInspector).not.toHaveBeenCalled();
		expect(actions.openSlides).not.toHaveBeenCalled();
		expect(actions.openComments).not.toHaveBeenCalled();
		expect(actions.openNotes).not.toHaveBeenCalled();
	});

	it('switches to a different sheet, closing the previous one first', () => {
		const actions = actionsSpy();
		applyMobileBarSheetTap('comments', 'slides', actions);
		expect(actions.closeAll).toHaveBeenCalledOnce();
		expect(actions.openComments).toHaveBeenCalledOnce();
		expect(actions.openSlides).not.toHaveBeenCalled();
	});

	it('matches shared toggleSheet for every pair, the same priority order every binding shares', () => {
		const keys = ['slides', 'inspector', 'comments', 'notes'] as const,
			openerByKey = {
				slides: 'openSlides',
				inspector: 'openInspector',
				comments: 'openComments',
				notes: 'openNotes',
			} as const;
		for (const current of [...keys, null]) {
			for (const tapped of keys) {
				const actions = actionsSpy(),
					expected = toggleSheet(current, tapped);
				applyMobileBarSheetTap(tapped, current, actions);
				expect(actions.closeAll).toHaveBeenCalledOnce();
				for (const key of keys) {
					const opener = actions[openerByKey[key]];
					if (expected === key) {
						expect(opener).toHaveBeenCalledOnce();
					} else {
						expect(opener).not.toHaveBeenCalled();
					}
				}
			}
		}
	});
});
