import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createRibbonTabBar } from './ribbon-tab-bar';

describe('ribbon tab scrolling', () => {
	it('keeps contextual tabs in the scrolling strip and quick actions outside it', () => {
		const onSelect = vi.fn();
		const startRecording = vi.fn();
		const bar = createRibbonTabBar(document, createTranslator(), onSelect, undefined, {
			startRecording,
		});
		bar.setContextualTabs(['shapeFormat']);
		bar.setActive('shapeFormat');
		const strip = bar.el.querySelector('[data-pptx-chrome="ribbon-tab-scroll"]')!;
		const contextual = strip.querySelector<HTMLButtonElement>('[data-ribbon-contextual-tab]')!;
		expect(contextual.getAttribute('aria-selected')).toBe('true');
		expect(strip.querySelector('.pptxv-tabrow-actions')).toBeNull();
		contextual.click();
		bar.el.querySelector<HTMLButtonElement>('.pptxv-tabrow-record')!.click();
		expect(onSelect).toHaveBeenCalledWith('shapeFormat');
		expect(startRecording).toHaveBeenCalledOnce();
		bar.setContextualTabs([]);
		expect(strip.querySelector('[data-ribbon-contextual-tab]')).toBeNull();
	});

	it('keeps customized tab visibility after adding the scrolling strip', () => {
		const bar = createRibbonTabBar(document, createTranslator(), vi.fn());
		bar.setHiddenTabs(new Set(['file', 'design']));
		const tabs = [...bar.el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
		expect(tabs.find((tab) => tab.textContent === 'File')?.hidden).toBeFalsy();
		expect(tabs.find((tab) => tab.textContent === 'Design')?.hidden).toBeTruthy();
	});
});
