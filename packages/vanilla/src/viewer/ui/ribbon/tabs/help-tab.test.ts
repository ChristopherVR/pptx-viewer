import { resolveCustomization } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonNavHandlers } from '../ribbon-types';
import { createHelpTab } from './help-tab';

describe('help shared commands', () => {
	it('routes settings tabs and accessibility once through the shared buttons', () => {
		const openSettings = vi.fn();
		const openAccessibility = vi.fn();
		const handlers = { openSettings, openAccessibility } as unknown as RibbonNavHandlers;
		const el = createHelpTab(document, createTranslator(), handlers);
		const commands = [...el.querySelectorAll('pptx-ui-ribbon-command')];
		expect(commands.map((command) => command.getAttribute('label'))).toStrictEqual([
			'Settings',
			'Keyboard Shortcuts',
			'Accessibility Check',
		]);
		for (const command of commands) {
			command.shadowRoot!.querySelector('button')!.click();
		}
		expect(openSettings.mock.calls).toStrictEqual([['general'], ['shortcuts']]);
		expect(openAccessibility).toHaveBeenCalledOnce();
	});

	it('hides both Options entry points when the host removes the dialog', () => {
		const handlers = {
			openSettings: vi.fn(),
			openAccessibility: vi.fn(),
			getCustomization: () => resolveCustomization({ hiddenDialogs: ['options'] }),
		} as unknown as RibbonNavHandlers;
		const el = createHelpTab(document, createTranslator(), handlers);
		expect(
			[...el.querySelectorAll('pptx-ui-ribbon-command')].map((command) =>
				command.getAttribute('data-ribbon-control'),
			),
		).toStrictEqual(['help.help.accessibility']);
	});
});
