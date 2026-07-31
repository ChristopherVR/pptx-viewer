import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createTransitionsTab } from './transitions-tab';

function named(tab: { el: HTMLElement }, label: string): HTMLElement[] {
	return [...tab.el.querySelectorAll<HTMLElement>('button, input, select')].filter(
		(node) => node.getAttribute('aria-label') === label,
	);
}

describe('createTransitionsTab', () => {
	it('offers Preview, Sound, Apply to All and the Inspector toggle', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, { applyTransition: vi.fn() }, vi.fn());
		expect(named(tab, t('pptx.ribbon.preview'))).toHaveLength(1);
		expect(named(tab, t('pptx.ribbon.sound'))).toHaveLength(1);
		expect(named(tab, t('pptx.headerFooter.applyToAll'))).toHaveLength(1);
		expect(named(tab, t('pptx.ribbon.inspector'))).toHaveLength(1);
	});

	it('offers the Advance Slide group, with both After controls React renders', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, { applyTransition: vi.fn() }, vi.fn());
		expect(named(tab, t('pptx.ribbon.onMouseClick'))).toHaveLength(1);
		// The checkbox and its duration box share one name in React, which derives
		// both from the single wrapping label.
		expect(named(tab, t('pptx.ribbon.afterDuration'))).toHaveLength(2);
	});

	it('opens the inspector from the Inspector button', () => {
		const t = createTranslator();
		const onToggleInspector = vi.fn();
		const tab = createTransitionsTab(document, t, { applyTransition: vi.fn() }, onToggleInspector);
		(named(tab, t('pptx.ribbon.inspector'))[0] as HTMLButtonElement).click();
		expect(onToggleInspector).toHaveBeenCalledOnce();
	});

	it('carries the Advance Slide settings into the applied transition', () => {
		const t = createTranslator();
		const applyTransition = vi.fn();
		const tab = createTransitionsTab(document, t, { applyTransition }, vi.fn());
		const [afterCheckbox, afterSeconds] = named(
			tab,
			t('pptx.ribbon.afterDuration'),
		) as HTMLInputElement[];
		afterCheckbox.checked = true;
		afterCheckbox.dispatchEvent(new Event('change'));
		afterSeconds.value = '00:02.00';

		const fade = tab.el.querySelector<HTMLButtonElement>(
			`.pptxv-transition-gallery button[aria-label="${t('pptx.ribbon.transition.fade')}"]`,
		);
		fade?.click();
		expect(applyTransition).toHaveBeenCalledWith('fade', 700, false, {
			onClick: true,
			afterMs: 2000,
		});
	});

	it('setEditable gates the gallery and the advance controls together', () => {
		const t = createTranslator();
		const tab = createTransitionsTab(document, t, { applyTransition: vi.fn() }, vi.fn());
		tab.setEditable(false);
		const preset = tab.el.querySelector<HTMLButtonElement>('.pptxv-transition-gallery button');
		expect(preset?.disabled).toBeTruthy();
		expect(
			(named(tab, t('pptx.ribbon.onMouseClick'))[0] as HTMLInputElement).disabled,
		).toBeTruthy();

		tab.setEditable(true);
		expect(preset?.disabled).toBeFalsy();
		expect((named(tab, t('pptx.ribbon.onMouseClick'))[0] as HTMLInputElement).disabled).toBeFalsy();
	});
});
