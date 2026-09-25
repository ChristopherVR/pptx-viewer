// @vitest-environment happy-dom
/**
 * Group- and control-level ribbon customisation, end to end through the real
 * `PowerPointViewer`: the viewer root carries its scope token, ONE style
 * element holds the shared `ribbonCustomizationCss` for it, the Home tab is
 * tagged with the catalogue ids, and the handle's `hideRibbonGroup` updates
 * the sheet live.
 */
import { RIBBON_SCOPE_ATTR } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
		i18n: {
			language: 'en',
			languages: ['en'],
			options: { resources: { en: {} } },
			changeLanguage: () => Promise.resolve(),
		},
	}),
}));

const { PptxHandler } = await import('pptx-viewer-core');
const { PowerPointViewer } = await import('../index');
type ViewerHandle = import('../index').PowerPointViewerHandle;
type ViewerCustomization = import('../index').ViewerCustomization;

async function sampleDeck(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	window.happyDOM?.setViewport({ width: 1600, height: 950 });
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

async function mount(
	customization?: ViewerCustomization,
): Promise<React.RefObject<ViewerHandle | null>> {
	const content = await sampleDeck();
	const ref = createRef<ViewerHandle>();
	await act(async () => {
		root.render(
			<PowerPointViewer ref={ref} content={content} canEdit customization={customization} />,
		);
	});
	for (let attempt = 0; attempt < 80; attempt += 1) {
		if (
			(ref.current?.getSlideCount() ?? 0) > 0 &&
			container.querySelector('[data-ribbon-group="home.clipboard"]')
		) {
			return ref;
		}
		await act(async () => {
			await new Promise((resolve) => {
				setTimeout(resolve, 20);
			});
		});
	}
	throw new Error('the viewer never finished loading its deck');
}

function scopeToken(): string {
	const scoped = container.querySelector(`[${RIBBON_SCOPE_ATTR}]`);
	const token = scoped?.getAttribute(RIBBON_SCOPE_ATTR);
	if (!token) {
		throw new Error('the viewer root carries no ribbon scope token');
	}
	return token;
}

function customizationStyles(): HTMLStyleElement[] {
	return Array.from(container.querySelectorAll<HTMLStyleElement>('style')).filter((style) =>
		style.hasAttribute('data-pptx-ribbon-customization'),
	);
}

describe('powerPointViewer ribbon group / control customisation', () => {
	it('renders one scoped style element hiding the named group and control', async () => {
		await mount({
			ribbon: { hiddenGroups: ['home.font'], hiddenButtons: ['home.paragraph.bullets'] },
		});
		const token = scopeToken();
		expect(token).toMatch(/^[\w-]+$/u);
		const styles = customizationStyles();
		expect(styles).toHaveLength(1);
		const css = styles[0].textContent ?? '';
		expect(css).toContain(`[${RIBBON_SCOPE_ATTR}="${token}"] [data-ribbon-group="home.font"]`);
		expect(css).toContain(
			`[${RIBBON_SCOPE_ATTR}="${token}"] [data-ribbon-control="home.paragraph.bullets"]`,
		);
		expect(css).toContain('display: none !important');
		// The rules reach real markup: the style sits inside the scoped root.
		expect(container.querySelector(`[${RIBBON_SCOPE_ATTR}="${token}"] style`)).toBe(styles[0]);
	});

	it('tags every Home group and the Bullets control with the catalogue ids', async () => {
		await mount();
		for (const group of ['clipboard', 'slides', 'font', 'paragraph', 'drawing', 'editing']) {
			expect(container.querySelector(`[data-ribbon-group="home.${group}"]`)).not.toBeNull();
		}
		expect(
			container.querySelector('[data-ribbon-control="home.paragraph.bullets"]'),
		).not.toBeNull();
		expect(container.querySelector('[data-ribbon-control="home.font.bold"]')).not.toBeNull();
		expect(customizationStyles()[0]?.textContent ?? '').toBe('');
	});

	it('updates the style live through hideRibbonGroup on the handle', async () => {
		const ref = await mount();
		await act(async () => {
			ref.current?.hideRibbonGroup('home.editing');
		});
		expect(customizationStyles()[0]?.textContent ?? '').toContain(
			'[data-ribbon-group="home.editing"]',
		);
	});
});
