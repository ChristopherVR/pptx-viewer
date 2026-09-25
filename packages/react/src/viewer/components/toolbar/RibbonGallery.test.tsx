// @vitest-environment happy-dom
/**
 * The React ribbon galleries and contextual tabs.
 *
 * The gallery is driven through the REAL shared Shape Styles gallery and the
 * REAL `useRibbonGalleryCommands` dispatcher, so a tile click proves the whole
 * path: shared apply result in, element patch merged through the viewer's
 * `updateElementById` out.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { RibbonGalleryPlacement } from 'pptx-viewer-shared';
import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
import React, { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ToolbarProps } from './toolbar-types';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			params && typeof params.name === 'string' ? `${key}:${params.name}` : key,
	}),
}));

const { RibbonGallery } = await import('./RibbonGallery');
const { RibbonGalleryCommandsContext } = await import('../ribbon-gallery-context');
const { useRibbonGalleryCommands } = await import('../../hooks/useRibbonGalleryCommands');
const { Toolbar } = await import('../Toolbar');

const COLOR_MAP = { dk1: '#000000', lt1: '#FFFFFF', accent1: '#156082', accent2: '#E97132' };

function shape(): PptxElement {
	return {
		id: 's1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		shapeStyle: { fillColor: '#FF0000', fillMode: 'solid' },
	} as unknown as PptxElement;
}

const INLINE_SHAPE_STYLES: RibbonGalleryPlacement = CONTEXTUAL_TAB_GROUPS.shapeFormat[0]
	.galleries[0] as RibbonGalleryPlacement;

let container: HTMLDivElement;
let root: Root;
let latest: PptxElement | null = null;
const updates: Array<{ id: string; patch: Partial<PptxElement> }> = [];

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	updates.length = 0;
	latest = null;
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function GalleryHarness({ placement }: { placement: RibbonGalleryPlacement }) {
	const [element, setElement] = useState<PptxElement>(shape);
	latest = element;
	const handlerRef = useRef(null);
	const commands = useRibbonGalleryCommands({
		selectedElement: element,
		theme: undefined,
		themeColorMap: COLOR_MAP,
		handlerRef,
		editable: true,
		updateElementById: (id, patch) => {
			updates.push({ id, patch });
			setElement((prev) => ({ ...prev, ...patch }) as PptxElement);
		},
		updateThemeColorScheme: vi.fn<() => Promise<void>>(),
		updateThemeFontScheme: vi.fn<() => Promise<void>>(),
	});
	return (
		<RibbonGalleryCommandsContext.Provider value={commands}>
			<RibbonGallery placement={placement} />
		</RibbonGalleryCommandsContext.Provider>
	);
}

function click(el: Element | null): void {
	if (!el) {
		throw new Error('nothing to click');
	}
	act(() => {
		(el as HTMLElement).click();
	});
}

describe('ribbonGallery', () => {
	it('renders an inline strip, the more button and a popup of every tile', () => {
		act(() => root.render(<GalleryHarness placement={INLINE_SHAPE_STYLES} />));
		const wrapper = container.querySelector(
			'[data-ribbon-control="shapeFormat.shapeStyles.gallery"]',
		);
		expect(wrapper).not.toBeNull();
		expect(wrapper?.querySelectorAll('[data-gallery-item]')).toHaveLength(6);
		const more = wrapper?.querySelector('[data-ribbon-gallery="shapeStyles"]');
		expect(more?.getAttribute('aria-label')).toBe('pptx.gallery.more:Shape Styles');
		click(more ?? null);
		const popup = container.querySelector('[data-ribbon-gallery-popup="shapeStyles"]');
		// PowerPoint's 42 theme styles and 35 presets.
		expect(popup?.querySelectorAll('[data-gallery-item]')).toHaveLength(77);
		const tile = popup?.querySelector('[data-gallery-item]');
		expect(tile?.querySelector('svg')).not.toBeNull();
		expect(tile?.getAttribute('aria-label')).toBeTruthy();
	});

	it('dispatches a pick as an element patch and marks the tile applied', () => {
		act(() => root.render(<GalleryHarness placement={INLINE_SHAPE_STYLES} />));
		const tiles = () =>
			Array.from(container.querySelectorAll<HTMLButtonElement>('[data-gallery-item]'));
		expect(tiles().every((tile) => tile.getAttribute('aria-pressed') === 'false')).toBeTruthy();
		const id = tiles()[1].getAttribute('data-gallery-item');
		click(tiles()[1]);
		expect(updates).toHaveLength(1);
		expect(updates[0].id).toBe('s1');
		expect(updates[0].patch).toHaveProperty('shapeStyle');
		expect(latest && 'shapeStyle' in latest ? latest.shapeStyle : undefined).toStrictEqual(
			(updates[0].patch as { shapeStyle: unknown }).shapeStyle,
		);
		const applied = container.querySelector(`[data-gallery-item="${id}"]`);
		expect(applied?.getAttribute('aria-pressed')).toBe('true');
	});

	it('renders disabled without a provider', () => {
		act(() => root.render(<RibbonGallery placement={INLINE_SHAPE_STYLES} />));
		const more = container.querySelector<HTMLButtonElement>('[data-ribbon-gallery="shapeStyles"]');
		expect(more?.disabled).toBeTruthy();
	});
});

const FN_PROPS = [
	'onSetMode',
	'onToggleSidebar',
	'onToggleInspector',
	'onToggleCompactToolbar',
	'onZoomIn',
	'onZoomOut',
	'onZoomToFit',
	'onUndo',
	'onRedo',
	'onToggleFindReplace',
	'onSetNewShapeType',
	'onAddTextBox',
	'onAddShape',
	'onAddTable',
	'onAddSmartArt',
	'onAddEquation',
	'onAddActionButton',
	'onOpenImagePicker',
	'onOpenMediaPicker',
	'onSetActiveTool',
	'onSetDrawingColor',
	'onSetDrawingWidth',
	'onSetEditTemplateMode',
	'onSetSpellCheckEnabled',
	'onSetShowGrid',
	'onSetShowRulers',
	'onSetSnapToGrid',
	'onSetSnapToShape',
	'onAddGuide',
	'onAlignElements',
	'onCopy',
	'onCut',
	'onPaste',
	'onFlip',
	'onMoveLayer',
	'onMoveLayerToEdge',
	'onDuplicate',
	'onDelete',
	'onUpdateTextStyle',
	'onToggleBullets',
	'onTransformTextCase',
	'onInsertSlideFromLayout',
	'onToggleThemeEditor',
	'onToggleThemeGallery',
	'onSetOverflowMenuOpen',
	'onSetActiveCustomShowId',
	'onCreateCustomShow',
	'onRenameActiveCustomShow',
	'onDeleteActiveCustomShow',
	'onToggleCurrentSlideInActiveShow',
] as const;

function toolbarProps(overrides: Partial<ToolbarProps>): ToolbarProps {
	const fns = Object.fromEntries(FN_PROPS.map((name) => [name, vi.fn<() => void>()]));
	return {
		mode: 'edit',
		canEdit: true,
		isNarrowViewport: false,
		isSidebarCollapsed: false,
		isInspectorPaneOpen: false,
		isCompactToolbarOpen: false,
		toolbarSection: 'insert',
		scale: 1,
		canUndo: false,
		canRedo: false,
		findReplaceOpen: false,
		selectedElement: null,
		editTemplateMode: false,
		newShapeType: 'rect',
		activeTool: 'select',
		drawingColor: '#000000',
		drawingWidth: 2,
		clipboardPayload: null,
		spellCheckEnabled: false,
		showGrid: false,
		showRulers: false,
		snapToGrid: false,
		snapToShape: false,
		layoutOptions: [],
		customShows: [],
		activeCustomShowId: null,
		isCurrentSlideInActiveShow: false,
		isThemeEditorOpen: false,
		isThemeGalleryOpen: false,
		isOverflowMenuOpen: false,
		onSetToolbarSection: vi.fn<() => void>(),
		...fns,
		...overrides,
	} as unknown as ToolbarProps;
}

describe('contextual ribbon tabs', () => {
	it('shows Shape Format for a shape and falls back to Home on deselect', () => {
		const sections: string[] = [];
		function Harness({ selectedElement }: { selectedElement: PptxElement | null }) {
			const [section, setSection] = useState<ToolbarProps['toolbarSection']>('insert');
			return (
				<Toolbar
					{...toolbarProps({
						selectedElement,
						toolbarSection: section,
						onSetToolbarSection: (next) => {
							sections.push(next);
							setSection(next);
						},
					})}
				/>
			);
		}
		const render = (selectedElement: PptxElement | null) =>
			act(() => root.render(<Harness selectedElement={selectedElement} />));
		render(null);
		expect(container.querySelector('[data-ribbon-contextual-tab]')).toBeNull();

		render(shape());
		const tab = container.querySelector('[data-ribbon-contextual-tab="shapeFormat"]');
		expect(tab?.textContent).toBe('pptx.ribbon.tab.shapeFormat');
		// Selecting never switches tabs on its own.
		expect(tab?.getAttribute('aria-selected')).toBe('false');
		expect(container.querySelector('[data-ribbon-group="shapeFormat.shapeStyles"]')).toBeNull();

		click(tab);
		expect(tab?.getAttribute('aria-selected')).toBe('true');
		expect(container.querySelector('[data-ribbon-group="shapeFormat.shapeStyles"]')).not.toBeNull();
		expect(
			container.querySelector('[data-ribbon-group="shapeFormat.wordArtStyles"]'),
		).not.toBeNull();
		expect(container.querySelector('[data-ribbon-group="insert.text"]')).toBeNull();

		render(null);
		expect(container.querySelector('[data-ribbon-contextual-tab]')).toBeNull();
		expect(sections).toStrictEqual(['home']);
		expect(container.querySelector('[data-ribbon-group="shapeFormat.shapeStyles"]')).toBeNull();
		expect(container.querySelector('[data-ribbon-group="home.clipboard"]')).not.toBeNull();
	});

	it('replaces the Shape Effects placeholder with the shared galleries on Home', () => {
		act(() => root.render(<Toolbar {...toolbarProps({ toolbarSection: 'home' })} />));
		expect(container.querySelector('[title="pptx.drawing.shapeEffectsUnavailable"]')).toBeNull();
		const effects = container.querySelector('[data-ribbon-control="home.drawing.shapeEffects"]');
		expect(effects?.querySelector('[data-ribbon-gallery="shapeEffects"]')).not.toBeNull();
		expect(
			container.querySelector(
				'[data-ribbon-control="home.drawing.quickStyles"] [data-ribbon-gallery="shapeStyles"]',
			),
		).not.toBeNull();
		for (const kind of ['bullets', 'numbering']) {
			const pair = container.querySelector(`[data-ribbon-control="home.paragraph.${kind}"]`);
			expect(pair?.querySelector(`[data-ribbon-gallery="${kind}"]`)).not.toBeNull();
			expect(pair?.querySelector('[aria-pressed]')).not.toBeNull();
		}
	});

	it('adds a Variants group to Design', () => {
		act(() => root.render(<Toolbar {...toolbarProps({ toolbarSection: 'design' })} />));
		const variants = container.querySelector('[data-ribbon-group="design.variants"]');
		expect(variants?.textContent).toContain('pptx.ribbon.groupVariants');
		expect(
			variants?.querySelector(
				'[data-ribbon-control="design.variants.colors"] [data-ribbon-gallery="themeColors"]',
			),
		).not.toBeNull();
		expect(
			variants?.querySelector(
				'[data-ribbon-control="design.variants.fonts"] [data-ribbon-gallery="themeFonts"]',
			),
		).not.toBeNull();
	});
});
