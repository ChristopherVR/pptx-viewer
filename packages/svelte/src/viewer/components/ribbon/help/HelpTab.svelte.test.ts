import { mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import HelpTab from './HelpTab.svelte';

describe('help shared commands', () => {
	it('orders and routes all commands and hides unwired Settings', () => {
		for (const withSettings of [true, false]) {
			const target = document.createElement('div');
			const settings = vi.fn();
			const shortcuts = vi.fn();
			const accessibility = vi.fn();
			const instance = mount(HelpTab, {
				target,
				props: {
					onsettings: withSettings ? settings : undefined,
					onshortcuts: shortcuts,
					onaccessibility: accessibility,
				},
			});
			try {
				const commands = [...target.querySelectorAll('pptx-ui-ribbon-command')];
				expect(
					commands.map((command) => command.getAttribute('data-ribbon-control')),
				).toStrictEqual([
					...(withSettings ? ['help.help.options'] : []),
					'help.help.keyboardShortcuts',
					'help.help.accessibility',
				]);
				for (const command of commands) {
					command.shadowRoot!.querySelector('button')!.click();
				}
				expect(settings).toHaveBeenCalledTimes(withSettings ? 1 : 0);
				expect(shortcuts).toHaveBeenCalledOnce();
				expect(accessibility).toHaveBeenCalledOnce();
			} finally {
				unmount(instance);
			}
		}
	});
});
