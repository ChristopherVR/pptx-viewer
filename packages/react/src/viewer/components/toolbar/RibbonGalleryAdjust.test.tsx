// @vitest-environment happy-dom
/**
 * Picture Format > Adjust: the Corrections, Color and Artistic Effects
 * dropdown galleries. Driven through the REAL shared galleries and the REAL
 * `useRibbonGalleryCommands` dispatcher, so a tile click proves the whole
 * path: shared apply result in, `imageEffects` patch merged through the
 * viewer's `updateElementById` out.
 */
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import type { RibbonGalleryPlacement } from 'pptx-viewer-shared';
import { CONTEXTUAL_TAB_GROUPS } from 'pptx-viewer-shared';
import React, { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, params?: Record<string, unknown>) =>
			params && typeof params.name === 'string' ? `${key}:${params.name}` : key,
	}),
}));

const { RibbonGallery } = await import('./RibbonGallery');
const { ContextualTabSection } = await import('./ContextualTabSection');
const { RibbonGalleryCommandsContext } = await import('../ribbon-gallery-context');
const { useRibbonGalleryCommands } = await import('../../hooks/useRibbonGalleryCommands');

function picture(): PptxElement {
	return {
		id: 'p1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeStyle: {},
	} as unknown as PptxElement;
}

const ADJUST = CONTEXTUAL_TAB_GROUPS.pictureFormat.find((g) => g.group === 'pictureFormat.adjust');
const placementFor = (gallery: string): RibbonGalleryPlacement =>
	ADJUST?.galleries.find((p) => p.gallery === gallery) as RibbonGalleryPlacement;

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

function Harness({ placement }: { placement: RibbonGalleryPlacement }) {
	const [element, setElement] = useState<PptxElement>(picture);
	latest = element;
	const handlerRef = useRef(null);
	const commands = useRibbonGalleryCommands({
		selectedElement: element,
		theme: undefined,
		themeColorMap: { accent1: '#156082' },
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

function effectsOf(element: PptxElement | null): PptxImageEffects | undefined {
	return (element as { imageEffects?: PptxImageEffects } | null)?.imageEffects;
}

describe('picture adjust galleries', () => {
	it('renders the Adjust group with its three galleries', () => {
		act(() => root.render(<Harness placement={placementFor('pictureCorrections')} />));
		expect(ADJUST?.galleries.map((p) => p.gallery)).toStrictEqual([
			'pictureCorrections',
			'pictureColor',
			'pictureArtisticEffects',
		]);
		const trigger = container.querySelector('[data-ribbon-gallery="pictureCorrections"]');
		expect((trigger as HTMLButtonElement).disabled).toBeFalsy();
	});

	it('mounts the Adjust group on the Picture Format tab', () => {
		act(() => root.render(<ContextualTabSection tab='pictureFormat' />));
		expect(container.querySelector('[data-ribbon-group="pictureFormat.adjust"]')).not.toBeNull();
		for (const gallery of ['pictureCorrections', 'pictureColor', 'pictureArtisticEffects']) {
			expect(container.querySelector(`[data-ribbon-gallery="${gallery}"]`)).not.toBeNull();
		}
	});

	it.each([
		['pictureCorrections', 'soften50', 'sharpenSoften', { amount: -50000 }],
		['pictureColor', 'saturation200', 'colorSaturation', { sat: 200000 }],
		['pictureColor', 'recolorGrayscale', 'grayscale', true],
		['pictureArtisticEffects', 'paintStrokes', 'artisticEffect', 'paintStrokes'],
	] as const)(
		'%s pick %s updates imageEffects.%s and marks the tile',
		(gallery, item, key, value) => {
			act(() => root.render(<Harness placement={placementFor(gallery)} />));
			click(container.querySelector(`[data-ribbon-gallery="${gallery}"]`));
			const popup = container.querySelector(`[data-ribbon-gallery-popup="${gallery}"]`);
			expect(popup?.querySelector('svg')).not.toBeNull();
			click(popup?.querySelector(`[data-gallery-item="${item}"]`) ?? null);
			expect(updates).toHaveLength(1);
			expect(updates[0].id).toBe('p1');
			expect(effectsOf(latest)?.[key as keyof PptxImageEffects]).toStrictEqual(value);
			click(container.querySelector(`[data-ribbon-gallery="${gallery}"]`));
			const applied = container.querySelector(`[data-gallery-item="${item}"]`);
			expect(applied?.getAttribute('aria-pressed')).toBe('true');
		},
	);
});
