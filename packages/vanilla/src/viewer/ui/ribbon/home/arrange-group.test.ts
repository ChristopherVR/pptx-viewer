import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createArrangeGroup } from './arrange-group';

function handlers() {
	return {
		bringForward: vi.fn(),
		sendBackward: vi.fn(),
		bringToFront: vi.fn(),
		sendToBack: vi.fn(),
		alignElements: vi.fn(),
		distributeElements: vi.fn(),
		flipHorizontal: vi.fn(),
		flipVertical: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		duplicate: vi.fn(),
		delete: vi.fn(),
	};
}

function button(group: ReturnType<typeof createArrangeGroup>, label: string): HTMLButtonElement {
	const match = [...group.el.querySelectorAll<HTMLButtonElement>('button')].find(
		(item) => item.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing arrange button: ${label}`);
	}
	return match;
}

describe('createArrangeGroup multi-selection', () => {
	it('enables grouping for two elements and distribution for three', () => {
		const t = createTranslator();
		const group = createArrangeGroup(document, t, handlers());
		const groupButton = button(group, t('pptx.ribbon.group'));
		const distributeButton = button(group, t('pptx.arrange.distributeHorizontal'));

		group.update({ editable: true, hasSelection: true, isGroup: false, selectedCount: 1 });
		expect(groupButton.disabled).toBeTruthy();
		expect(distributeButton.disabled).toBeTruthy();

		group.update({ editable: true, hasSelection: true, isGroup: false, selectedCount: 2 });
		expect(groupButton.disabled).toBeFalsy();
		expect(distributeButton.disabled).toBeTruthy();

		group.update({ editable: true, hasSelection: true, isGroup: false, selectedCount: 3 });
		expect(groupButton.disabled).toBeFalsy();
		expect(distributeButton.disabled).toBeFalsy();
	});

	it('dispatches multi-selection arrange commands', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createArrangeGroup(document, t, actions);
		group.update({ editable: true, hasSelection: true, isGroup: false, selectedCount: 3 });

		button(group, t('pptx.ribbon.group')).click();
		button(group, t('pptx.arrange.distributeHorizontal')).click();

		expect(actions.groupSelected).toHaveBeenCalledOnce();
		expect(actions.distributeElements).toHaveBeenCalledWith('horizontal');
	});
});
