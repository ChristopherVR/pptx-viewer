// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILT_IN_THEMES, ThemeGallery } from './ThemeGallery';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

let container: HTMLDivElement;
let root: Root;

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

function renderGallery(currentThemeIndex: number): void {
	act(() => {
		root.render(
			<ThemeGallery
				open
				currentTheme={BUILT_IN_THEMES[currentThemeIndex]}
				canEdit
				onClose={vi.fn()}
				onApplyTheme={vi.fn()}
			/>,
		);
	});
}

describe('themeGallery', () => {
	it('selects the current theme and follows later current-theme changes', () => {
		renderGallery(0);
		expect(container.querySelector<HTMLButtonElement>('[title="Office"]')?.className).toContain(
			'border-primary',
		);

		renderGallery(1);
		expect(container.querySelector<HTMLButtonElement>('[title="Facet"]')?.className).toContain(
			'border-primary',
		);
	});
});
