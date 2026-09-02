// @vitest-environment happy-dom
import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReadOnlyBanner } from './ReadOnlyBanner';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const modifyVerifierRecommendation: ReadOnlyRecommendation = {
	kind: 'modifyVerifier',
	messageKey: 'pptx.readOnly.modifyVerifierRecommended',
	defaultReadOnly: true,
};

describe('readOnlyBanner', () => {
	it('carries the pptx-readonly-banner testid with data-kind set from the recommendation', () => {
		act(() =>
			root.render(
				<ReadOnlyBanner
					recommendation={modifyVerifierRecommendation}
					onEditAnyway={() => {}}
					onDismiss={() => {}}
				/>,
			),
		);
		const banner = container.querySelector('[data-testid="pptx-readonly-banner"]');
		expect(banner).not.toBeNull();
		expect(banner?.getAttribute('data-kind')).toBe('modifyVerifier');
	});

	it('calls onEditAnyway when "Edit anyway" is clicked', () => {
		const onEditAnyway = vi.fn();
		act(() =>
			root.render(
				<ReadOnlyBanner
					recommendation={modifyVerifierRecommendation}
					onEditAnyway={onEditAnyway}
					onDismiss={() => {}}
				/>,
			),
		);
		const button = container.querySelector(
			'[data-testid="pptx-readonly-edit-anyway"]',
		) as HTMLButtonElement;
		act(() => button.click());
		expect(onEditAnyway).toHaveBeenCalledOnce();
	});

	it('calls onDismiss when "Dismiss" is clicked', () => {
		const onDismiss = vi.fn();
		act(() =>
			root.render(
				<ReadOnlyBanner
					recommendation={modifyVerifierRecommendation}
					onEditAnyway={() => {}}
					onDismiss={onDismiss}
				/>,
			),
		);
		const button = container.querySelector(
			'[data-testid="pptx-readonly-dismiss"]',
		) as HTMLButtonElement;
		act(() => button.click());
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
