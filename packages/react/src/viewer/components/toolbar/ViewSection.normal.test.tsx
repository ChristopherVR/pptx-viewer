// @vitest-environment happy-dom
/**
 * Regression test for View > Normal: the ribbon pill used to render with no
 * `onClick` at all in React (and, as it turned out while fixing this, in Vue
 * and Angular too), so it did nothing when clicked. See CLAUDE.md's editor
 * parity rule: a UI fix like this must be checked and applied in all five
 * bindings, not just the one an audit named.
 */
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ViewSectionProps } from './ViewSection';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const { ViewSection } = await import('./ViewSection');

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

function baseProps(overrides: Partial<ViewSectionProps> = {}): ViewSectionProps {
	return {
		canEdit: true,
		editTemplateMode: false,
		onSetEditTemplateMode: vi.fn(),
		spellCheckEnabled: false,
		onSetSpellCheckEnabled: vi.fn(),
		showGrid: false,
		showRulers: false,
		showGuides: false,
		snapToGrid: false,
		snapToShape: false,
		onSetShowGrid: vi.fn(),
		onSetShowRulers: vi.fn(),
		onSetShowGuides: vi.fn(),
		onSetSnapToGrid: vi.fn(),
		onSetSnapToShape: vi.fn(),
		onAddGuide: vi.fn(),
		onEnterMasterView: vi.fn(),
		...overrides,
	};
}

describe('viewSection > Normal', () => {
	it('calls onGoToNormalView when the Normal pill is clicked', () => {
		const onGoToNormalView = vi.fn();
		act(() => {
			root.render(React.createElement(ViewSection, baseProps({ onGoToNormalView })));
		});
		const button = Array.from(container.querySelectorAll('button')).find(
			(el) => el.textContent === translationsEn['pptx.view.normal'],
		);
		expect(button).toBeDefined();
		act(() => {
			button?.click();
		});
		expect(onGoToNormalView).toHaveBeenCalledOnce();
	});
});
