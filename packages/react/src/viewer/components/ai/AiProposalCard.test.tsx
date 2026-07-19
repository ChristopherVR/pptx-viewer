import type { PptxSlide } from 'pptx-viewer-core';
import { ProposalStore } from 'pptx-viewer-shared/ai';
import type { PptxAiBridge } from 'pptx-viewer-shared/ai';
// @vitest-environment happy-dom
import { translationsEn } from 'pptx-viewer-shared/i18n';
/**
 * AiProposalCard tests: a staged proposal renders its diff summary, and Accept /
 * Reject route through the real {@link ProposalStore}. Accept must reach the
 * bridge's `applySlidesUpdate` choke point (so the edit lands as one undoable
 * entry); Reject must drop the proposal without touching the deck.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const fallback = translationsEn[key];
			if (fallback === undefined) {
				return key;
			}
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

const { AiProposalCard } = await import('./AiProposalCard');

function makeSlides(): PptxSlide[] {
	return [
		{
			id: 's1',
			slideNumber: 1,
			elements: [{ id: 'e1', type: 'text', text: 'Title', x: 0, y: 0, width: 100, height: 20 }],
		},
	] as unknown as PptxSlide[];
}

function makeBridge(slides: PptxSlide[]): {
	bridge: PptxAiBridge;
	applied: { label: string }[];
} {
	const applied: { label: string }[] = [];
	let current = slides;
	const bridge = {
		getDeckMeta: () => ({
			slideCount: current.length,
			activeSlideIndex: 0,
			width: 960,
			height: 540,
		}),
		getSlides: () => current,
		getActiveSlideIndex: () => 0,
		getTheme: () => undefined,
		getHandler: () => undefined,
		goToSlide: () => {},
		selectElements: () => {},
		applySlidesUpdate: (updater: (s: PptxSlide[]) => PptxSlide[], label: string) => {
			current = updater(structuredClone(current));
			applied.push({ label });
		},
		updateElement: () => {},
		applyTheme: () => {},
	} satisfies PptxAiBridge;
	return { bridge, applied };
}

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
	act(() => root?.unmount());
	root = null;
	host?.remove();
	host = null;
});

function mount(element: React.ReactElement): HTMLElement {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => root?.render(element));
	return host;
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
	const btn = [...container.querySelectorAll('button')].find((b) =>
		(b.textContent ?? '').includes(label),
	);
	if (!btn) {
		throw new Error(`button "${label}" not found`);
	}
	return btn as HTMLButtonElement;
}

describe('aiProposalCard', () => {
	it('renders the proposal label and diff summary', () => {
		const store = new ProposalStore(makeBridge(makeSlides()).bridge);
		store.stage('Recolor title', (slides) => {
			slides[0].elements[0].x = 42;
			return slides;
		});
		const view = store.list()[0];
		const container = mount(
			React.createElement(AiProposalCard, {
				proposal: view,
				onAccept: () => {},
				onReject: () => {},
			}),
		);
		expect(container.textContent).toContain('Recolor title');
		expect(container.textContent).toContain('Suggested change');
		expect(view.summary.length).toBeGreaterThan(0);
	});

	it('routes Accept through the bridge and clears the proposal', () => {
		const { bridge, applied } = makeBridge(makeSlides());
		const store = new ProposalStore(bridge);
		store.stage('Move title', (slides) => {
			slides[0].elements[0].x = 99;
			return slides;
		});
		const view = store.list()[0];
		const container = mount(
			React.createElement(AiProposalCard, {
				proposal: view,
				onAccept: (id: string) => store.apply(id),
				onReject: (id: string) => store.revert(id),
			}),
		);
		act(() => {
			findButton(container, 'Apply').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(applied).toHaveLength(1);
		expect(applied[0].label).toBe('Move title');
		expect(store.size).toBe(0);
	});

	it('reject drops the proposal without touching the deck', () => {
		const { bridge, applied } = makeBridge(makeSlides());
		const store = new ProposalStore(bridge);
		store.stage('Delete title', (slides) => {
			slides[0].elements = [];
			return slides;
		});
		const view = store.list()[0];
		const container = mount(
			React.createElement(AiProposalCard, {
				proposal: view,
				onAccept: (id: string) => store.apply(id),
				onReject: (id: string) => store.revert(id),
			}),
		);
		act(() => {
			findButton(container, 'Discard').dispatchEvent(new MouseEvent('click', { bubbles: true }));
		});
		expect(applied).toHaveLength(0);
		expect(store.size).toBe(0);
	});
});
