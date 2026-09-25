import type { PptxElement } from 'pptx-viewer-core';
import type { RibbonGalleryContext } from 'pptx-viewer-shared';
import { EMPTY_RIBBON_TRANSITION_DRAFT, resolveCustomization } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createRibbon } from '../ribbon';
import { mountRibbonCustomizationStyle } from '../ribbon-customization-style';
import type { RibbonHandlers, RibbonSelectionState } from '../ribbon-types';

/** Every method access returns a memoised `vi.fn()`. */
function fakeActions<T extends object>(overrides: Partial<T> = {}): T {
	const cache = new Map<string, ReturnType<typeof vi.fn>>();
	return new Proxy({} as T, {
		get(_target, prop) {
			if (typeof prop !== 'string') {
				return undefined;
			}
			if (prop in overrides) {
				return overrides[prop as keyof T];
			}
			let fn = cache.get(prop);
			if (!fn) {
				fn = vi.fn();
				cache.set(prop, fn);
			}
			return fn;
		},
	});
}

function handlers(): RibbonHandlers {
	return {
		nav: fakeActions(),
		primary: fakeActions(),
		file: fakeActions<RibbonHandlers['file']>({ getRecentPresentationsCount: () => 10 }),
		slideShow: fakeActions<RibbonHandlers['slideShow']>({ showOptions: () => ({}) }),
		insert: fakeActions(),
		edit: fakeActions(),
		findReplace: fakeActions(),
		design: fakeActions(),
		transitions: fakeActions<RibbonHandlers['transitions']>({
			readDraft: () => ({ ...EMPTY_RIBBON_TRANSITION_DRAFT }),
			readTransition: () => undefined,
		}),
		draw: fakeActions(),
	};
}

function shape(): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#FF0000' },
	} as unknown as PptxElement;
}

function selection(element: PptxElement | undefined): RibbonSelectionState {
	const galleryContext: RibbonGalleryContext = {
		element: element ?? null,
		themeColorMap: { accent1: '#156082', dk1: '#000000', lt1: '#FFFFFF' },
	};
	return { hasClipboard: false, slideCount: 1, galleryContext };
}

function mount() {
	const ribbon = createRibbon(document, createTranslator(), handlers());
	ribbon.setEditState({ editable: true, canUndo: false, canRedo: false });
	ribbon.setEditable(true);
	return ribbon;
}

const visiblePane = (root: HTMLElement): HTMLElement | undefined =>
	Array.from(root.querySelectorAll<HTMLElement>('.pptxv-ribbon-tab-content')).find(
		(pane) => !pane.hidden,
	);

describe('ribbon contextual tabs (vanilla)', () => {
	it('shows Shape Format for a shape selection without switching to it', () => {
		const ribbon = mount();
		expect(ribbon.el.querySelector('[data-ribbon-contextual-tab]')).toBeNull();
		ribbon.updateSelection(shape(), selection(shape()));
		const tab = ribbon.el.querySelector<HTMLButtonElement>(
			'[data-ribbon-contextual-tab="shapeFormat"]',
		);
		expect(tab?.textContent).toBe('Shape Format');
		expect(visiblePane(ribbon.el)?.querySelector('[data-ribbon-group="home.font"]')).not.toBeNull();

		tab!.click();
		const pane = visiblePane(ribbon.el)!;
		expect(pane.querySelector('[data-ribbon-group="shapeFormat.shapeStyles"]')).not.toBeNull();
		expect(pane.querySelector('[data-ribbon-group="shapeFormat.wordArtStyles"]')).not.toBeNull();
		expect(
			pane.querySelectorAll(
				'[data-ribbon-control="shapeFormat.shapeStyles.gallery"] .pptxv-gallery-strip [data-gallery-item]',
			),
		).toHaveLength(6);
		expect(tab!.getAttribute('aria-selected')).toBe('true');
	});

	it('drops the contextual tab and falls back to Home on deselect', () => {
		const ribbon = mount();
		ribbon.updateSelection(shape(), selection(shape()));
		ribbon.el
			.querySelector<HTMLButtonElement>('[data-ribbon-contextual-tab="shapeFormat"]')!
			.click();
		ribbon.updateSelection(undefined, selection(undefined));
		expect(ribbon.el.querySelector('[data-ribbon-contextual-tab]')).toBeNull();
		// The pane goes with it, as in the other bindings, not just hidden.
		expect(ribbon.el.querySelector('[data-ribbon-group="shapeFormat.shapeStyles"]')).toBeNull();
		expect(
			visiblePane(ribbon.el)?.querySelector('[data-ribbon-group="home.clipboard"]'),
		).not.toBeNull();
	});

	it('replaces the Shape Effects placeholder with the shared gallery', () => {
		const ribbon = mount();
		const t = createTranslator();
		const placeholder = t('pptx.drawing.shapeEffectsUnavailable');
		expect(ribbon.el.querySelector(`[aria-label="${placeholder}"]`)).toBeNull();
		const drawing = ribbon.el.querySelector('[data-ribbon-group="home.drawing"]')!;
		expect(
			drawing.querySelector('[data-ribbon-control="home.drawing.shapeEffects"]'),
		).not.toBeNull();
		expect(
			drawing.querySelector(
				'[data-ribbon-control="home.drawing.quickStyles"] [data-ribbon-gallery="shapeStyles"]',
			),
		).not.toBeNull();
		const paragraph = ribbon.el.querySelector('[data-ribbon-group="home.paragraph"]')!;
		expect(
			paragraph.querySelector(
				'[data-ribbon-control="home.paragraph.bullets"] [data-ribbon-gallery="bullets"]',
			),
		).not.toBeNull();
		expect(
			paragraph.querySelector(
				'[data-ribbon-control="home.paragraph.numbering"] [data-ribbon-gallery="numbering"]',
			),
		).not.toBeNull();
		const variants = ribbon.el.querySelector('[data-ribbon-group="design.variants"]')!;
		expect(variants.querySelector('[data-ribbon-gallery="themeColors"]')).not.toBeNull();
		expect(variants.querySelector('[data-ribbon-gallery="themeFonts"]')).not.toBeNull();
	});
});

describe('ribbon customisation (vanilla)', () => {
	it('renders one scoped style element hiding the named groups and controls', () => {
		const root = document.createElement('div');
		const resolved = resolveCustomization({
			ribbon: { hiddenGroups: ['home.font'], hiddenButtons: ['home.paragraph.bullets'] },
		});
		const style = mountRibbonCustomizationStyle(document, root, resolved);
		const token = root.getAttribute('data-pptx-ribbon-scope');
		expect(token).toBe(style.token);
		expect(root.querySelectorAll('style')).toHaveLength(1);
		const css = style.el.textContent ?? '';
		expect(css).toContain(`[data-pptx-ribbon-scope="${token}"] [data-ribbon-group="home.font"]`);
		expect(css).toContain(
			`[data-pptx-ribbon-scope="${token}"] [data-ribbon-control="home.paragraph.bullets"]`,
		);
		style.update(resolveCustomization({}));
		expect(style.el.textContent).toBe('');
	});

	it('tags the Home tab groups and controls with catalogue ids', () => {
		const ribbon = mount();
		for (const group of [
			'home.clipboard',
			'home.slides',
			'home.font',
			'home.paragraph',
			'home.drawing',
			'home.arrange',
			'home.editing',
		]) {
			expect(ribbon.el.querySelector(`[data-ribbon-group="${group}"]`)).not.toBeNull();
		}
		for (const control of [
			'home.clipboard.paste',
			'home.font.bold',
			'home.paragraph.bullets',
			'home.arrange.align',
			'home.editing.find',
			'insert.tables.table',
			'view.show.ruler',
		]) {
			expect(ribbon.el.querySelector(`[data-ribbon-control="${control}"]`)).not.toBeNull();
		}
	});
});
