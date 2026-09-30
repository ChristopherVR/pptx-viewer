// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';

describe('subtitle settings controlled dialog', () => {
	it('emits only on Apply, discards Cancel drafts, isolates instances and closes on disconnect', () => {
		registerPptxWebControls();
		const first = document.createElement('pptx-ui-subtitle-settings');
		const second = document.createElement('pptx-ui-subtitle-settings');
		document.body.append(first, second);
		const change = vi.fn();
		first.addEventListener('subtitle-settings-change', change);
		const root = first.shadowRoot!;
		const dialog = root.querySelector('dialog')!;
		const select = root.querySelector('pptx-ui-select')!;
		const trigger = root
			.querySelector('pptx-ui-ribbon-command')!
			.shadowRoot!.querySelector('button')!;
		trigger.click();
		select.value = 'fr-FR';
		root.querySelectorAll('footer button')[0].dispatchEvent(new MouseEvent('click'));
		expect(change).not.toHaveBeenCalled();
		trigger.click();
		expect(select.value).toBe('auto');
		select.value = 'de-DE';
		(root.querySelectorAll('footer button')[1] as HTMLButtonElement).click();
		expect(change).toHaveBeenCalledOnce();
		expect((change.mock.calls[0][0] as CustomEvent).detail).toStrictEqual({
			spokenLanguage: 'de-DE',
		});
		expect(first.settings.spokenLanguage).toBe('auto');
		expect(second.settings.spokenLanguage).toBe('auto');
		trigger.click();
		first.remove();
		expect(dialog.open).toBeFalsy();
		second.remove();
	});
});
