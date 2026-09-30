import { resolveCustomization } from 'pptx-viewer-shared';
// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { ViewerCustomizationContext } from '../viewer-customization-context';
import { HelpSection } from './HelpSection';

vi.mock(import('react-i18next'), () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('help shared command adapter', () => {
	it('routes all commands once, replaces callbacks and retains the Settings fallback', () => {
		globalThis.IS_REACT_ACT_ENVIRONMENT = true;
		const container = document.createElement('div');
		const root = createRoot(container);
		const settings = vi.fn();
		const shortcuts = vi.fn();
		const accessibility = vi.fn();
		const hiddenOptions = resolveCustomization({ hiddenDialogs: ['options'] });
		const click = (id: string) =>
			act(() =>
				container
					.querySelector(`[data-ribbon-control="help.help.${id}"]`)!
					.shadowRoot!.querySelector('button')!
					.click(),
			);
		try {
			act(() =>
				root.render(
					<HelpSection
						onOpenSettings={settings}
						onToggleShortcuts={shortcuts}
						onRunAccessibilityCheck={accessibility}
					/>,
				),
			);
			expect(
				[...container.querySelectorAll('pptx-ui-ribbon-command')].map((host) =>
					host.getAttribute('data-ribbon-control'),
				),
			).toStrictEqual([
				'help.help.options',
				'help.help.keyboardShortcuts',
				'help.help.accessibility',
			]);
			click('options');
			click('keyboardShortcuts');
			click('accessibility');
			expect(settings).toHaveBeenCalledOnce();
			expect(shortcuts).toHaveBeenCalledOnce();
			expect(accessibility).toHaveBeenCalledOnce();
			act(() =>
				root.render(
					<HelpSection onToggleShortcuts={shortcuts} onRunAccessibilityCheck={accessibility} />,
				),
			);
			click('options');
			expect(settings).toHaveBeenCalledOnce();
			expect(shortcuts).toHaveBeenCalledTimes(2);
			act(() =>
				root.render(
					<ViewerCustomizationContext.Provider value={hiddenOptions}>
						<HelpSection onToggleShortcuts={shortcuts} onRunAccessibilityCheck={accessibility} />
					</ViewerCustomizationContext.Provider>,
				),
			);
			expect(container.querySelector('[data-ribbon-control="help.help.options"]')).toBeNull();
			expect(
				container.querySelector('[data-ribbon-control="help.help.keyboardShortcuts"]'),
			).not.toBeNull();
		} finally {
			act(() => root.unmount());
			globalThis.IS_REACT_ACT_ENVIRONMENT = false;
		}
	});
});
