/**
 * The contextual ribbon tabs (Shape Format, ...) and ribbon group/control
 * customisation, rendered:
 * - a shape selection appends `data-ribbon-contextual-tab="shapeFormat"`, the
 *   tab is never auto-selected, and deselecting falls back to Home;
 * - a contextual tab renders the shared `CONTEXTUAL_TAB_GROUPS`;
 * - Home > Drawing has the real Shape Effects gallery, not the old placeholder;
 * - the Home tab markup carries the catalogue group ids, and the viewer's one
 *   `<style>` holds the scoped selectors for the host's hidden ids.
 */
import { Component, signal } from '@angular/core';
import type { Type, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSlide, ShapePptxElement } from 'pptx-viewer-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n/translations-en';
import {
	EMPTY_RESOLVED_CUSTOMIZATION,
	resolveCustomization,
	ribbonCustomizationCss,
} from '../internal/shared';
import { componentSource } from './component-source.test-support';
import { EditorStateService } from './editor-state.service';
import { RecentColorsService } from './recent-colors.service';
import { RibbonContextualSectionComponent } from './ribbon-contextual-section.component';
import { createRibbonTabState } from './ribbon-contextual-tabs';
import { RibbonCustomizationStyleDirective } from './ribbon-customization-style.directive';
import { RibbonDrawingGroupComponent } from './ribbon-drawing-group.component';
import { RibbonTabListComponent } from './ribbon-tab-list.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});
afterEach(() => {
	TestBed.resetTestingModule();
});

function shape(): ShapePptxElement {
	return { id: 'sh1', type: 'shape', x: 0, y: 0, width: 100, height: 60, shapeType: 'rect' };
}

/** Render `component` with signal inputs (this JIT runner has no signal-input transform). */
function mount<T>(component: Type<T>, inputs: Record<string, unknown>): HTMLElement {
	TestBed.configureTestingModule({
		imports: [component],
		providers: [
			provideTranslateService({ fallbackLang: 'en' }),
			EditorStateService,
			{ provide: RecentColorsService, useValue: { recent: () => [], push: () => undefined } },
		],
	});
	TestBed.overrideComponent(component, { add: { inputs: Object.keys(inputs) } });
	TestBed.inject(TranslateService).setTranslation('en', translationsEn);
	TestBed.inject(TranslateService).use('en');
	TestBed.inject(EditorStateService).setSlides([
		{ id: 's1', slideNumber: 1, elements: [shape()] } as PptxSlide,
	]);
	const fixture = TestBed.createComponent(component);
	for (const [name, value] of Object.entries(inputs)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	fixture.detectChanges();
	return fixture.nativeElement as HTMLElement;
}

describe('contextual ribbon tabs', () => {
	it('appear for a shape, are not auto-selected, and fall back to Home on deselect', () => {
		const selected: WritableSignal<PptxElement | null> = signal(null);
		const state = createRibbonTabState(selected, signal(EMPTY_RESOLVED_CUSTOMIZATION));
		expect(state.contextualTabs()).toStrictEqual([]);
		selected.set(shape());
		expect(state.contextualTabs()).toStrictEqual(['shapeFormat']);
		expect(state.activeTab()).toBe('home');
		state.activeTab.set('shapeFormat');
		selected.set({ ...shape(), x: 5 });
		expect(state.activeTab()).toBe('shapeFormat');
		selected.set(null);
		expect(state.activeTab()).toBe('home');
		state.activeTab.set('design');
		selected.set(shape());
		expect(state.activeTab()).toBe('design');
	});

	it('honours a host-hidden contextual tab', () => {
		const resolved = resolveCustomization({ ribbon: { hiddenTabs: ['shapeFormat'] } });
		const state = createRibbonTabState(signal(shape()), signal(resolved));
		expect(state.contextualTabs()).toStrictEqual([]);
	});

	it('renders the contextual tab button after the fixed tabs', () => {
		const root = mount(RibbonTabListComponent, {
			activeTab: 'home',
			contextualTabs: ['shapeFormat'],
		});
		const tab = root.querySelector<HTMLButtonElement>('[data-ribbon-contextual-tab="shapeFormat"]');
		expect(tab?.textContent?.trim()).toBe(translationsEn['pptx.ribbon.tab.shapeFormat']);
		expect(tab?.getAttribute('aria-selected')).toBe('false');
		const tabs = [...root.querySelectorAll('[role="tab"]')];
		expect(tabs.at(-1)).toBe(tab);
	});

	it('renders the shared CONTEXTUAL_TAB_GROUPS as tagged ribbon groups', () => {
		const root = mount(RibbonContextualSectionComponent, {
			tab: 'shapeFormat',
			selectedElement: shape(),
			slideIndex: 0,
			canEdit: true,
		});
		expect(root.querySelector('[data-ribbon-group="shapeFormat.shapeStyles"]')).not.toBeNull();
		expect(root.querySelector('[data-ribbon-group="shapeFormat.wordArtStyles"]')).not.toBeNull();
		const inline = root.querySelector('[data-ribbon-control="shapeFormat.shapeStyles.gallery"]');
		expect(inline?.querySelector('[data-gallery-item]')).not.toBeNull();
		expect(
			root.querySelector(
				'[data-ribbon-control="shapeFormat.shapeStyles.shapeEffects"] [data-ribbon-gallery="shapeEffects"]',
			),
		).not.toBeNull();
	});
});

describe('home > drawing galleries', () => {
	it('replaces the Shape Effects placeholder with the shared gallery', () => {
		const root = mount(RibbonDrawingGroupComponent, {
			canEdit: true,
			slideIndex: 0,
			selectedElement: shape(),
		});
		expect(
			root.querySelector(
				'[data-ribbon-control="home.drawing.shapeEffects"] [data-ribbon-gallery="shapeEffects"]',
			),
		).not.toBeNull();
		expect(
			root.querySelector(
				'[data-ribbon-control="home.drawing.quickStyles"] [data-ribbon-gallery="shapeStyles"]',
			),
		).not.toBeNull();
		expect(root.textContent).not.toContain(translationsEn['pptx.drawing.shapeEffectsUnavailable']);
		expect(componentSource(import.meta.dirname, 'ribbon-drawing-group.component.ts')).not.toContain(
			'shapeEffectsUnavailable',
		);
	});
});

@Component({
	standalone: true,
	imports: [RibbonCustomizationStyleDirective],
	template: `<span hidden [pptxRibbonCustomizationStyle]="css()"></span>`,
})
class StyleHostComponent {
	readonly css = signal('');
}

describe('ribbon group/control customisation', () => {
	it('renders one style element with the scoped selectors', () => {
		TestBed.configureTestingModule({ imports: [StyleHostComponent] });
		const fixture = TestBed.createComponent(StyleHostComponent);
		const resolved = resolveCustomization({
			ribbon: { hiddenGroups: ['home.font'], hiddenButtons: ['home.paragraph.bullets'] },
		});
		fixture.componentInstance.css.set(ribbonCustomizationCss(resolved, 'pptx-ng-7'));
		fixture.detectChanges();
		const styles = (fixture.nativeElement as HTMLElement).querySelectorAll('style');
		expect(styles).toHaveLength(1);
		const text = styles[0].textContent ?? '';
		expect(text).toContain('[data-pptx-ribbon-scope="pptx-ng-7"] [data-ribbon-group="home.font"]');
		expect(text).toContain(
			'[data-pptx-ribbon-scope="pptx-ng-7"] [data-ribbon-control="home.paragraph.bullets"]',
		);
		fixture.componentInstance.css.set('');
		fixture.detectChanges();
		expect((fixture.nativeElement as HTMLElement).querySelectorAll('style')).toHaveLength(1);
		expect(styles[0].textContent).toBe('');
	});

	it('wires the scope token and the style onto the viewer root', () => {
		const viewer = componentSource(import.meta.dirname, 'power-point-viewer.component.ts');
		expect(viewer).toContain('[attr.data-pptx-ribbon-scope]="ribbonScope"');
		expect(viewer).toContain('[pptxRibbonCustomizationStyle]="ribbonCustomizationCss()"');
		expect(viewer).toContain(
			'ribbonCustomizationCss(this.customizationService.resolved(), this.ribbonScope)',
		);
	});

	it('tags the Home tab groups with the catalogue ids', () => {
		const home = [
			'ribbon-home-section.component.ts',
			'ribbon-clipboard-group.component.ts',
			'ribbon-drawing-group.component.ts',
			'ribbon-arrange-section.component.ts',
		]
			.map((file) => componentSource(import.meta.dirname, file))
			.join('\n');
		for (const group of [
			'clipboard',
			'slides',
			'font',
			'paragraph',
			'drawing',
			'arrange',
			'editing',
		]) {
			expect(home).toContain(`data-ribbon-group="home.${group}"`);
		}
		const paragraph = componentSource(
			import.meta.dirname,
			'ribbon-paragraph-controls.component.ts',
		);
		expect(paragraph).toContain('data-ribbon-control="home.paragraph.bullets"');
		expect(paragraph).toContain('gallery="bullets"');
		expect(paragraph).toContain('gallery="numbering"');
	});
});
