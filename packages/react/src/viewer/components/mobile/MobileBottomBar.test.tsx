// @vitest-environment happy-dom
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const { MobileBottomBar } = await import('./MobileBottomBar');

let container: HTMLDivElement, root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function renderBar(slideCount: number): void {
	act(() =>
		root.render(
			<MobileBottomBar
				slideCount={slideCount}
				activeSheet={null}
				onOpenSlides={() => {}}
				onOpenInsert={() => {}}
				onOpenInspector={() => {}}
				onOpenComments={() => {}}
				onToggleNotes={() => {}}
			/>,
		),
	);
}

describe('mobileBottomBar disabled gating', () => {
	it('disables every action when no slides are loaded', () => {
		renderBar(0);
		const buttons = [...container.querySelectorAll('button')];
		expect(buttons).toHaveLength(5);
		expect(buttons.every((button) => button.disabled)).toBeTruthy();
	});

	it('enables every action once slides are loaded', () => {
		renderBar(3);
		const buttons = [...container.querySelectorAll('button')];
		expect(buttons).toHaveLength(5);
		expect(buttons.every((button) => !button.disabled)).toBeTruthy();
	});
});
