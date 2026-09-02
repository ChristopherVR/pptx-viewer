// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useReadOnlyRecommendationState } from './useReadOnlyRecommendationState';
import type { UseReadOnlyRecommendationStateResult } from './useReadOnlyRecommendationState';

let latest: UseReadOnlyRecommendationStateResult | null = null;

function Harness({ content }: { content: unknown }) {
	latest = useReadOnlyRecommendationState(content);
	return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
	act(() => root?.unmount());
	host?.remove();
	root = null;
	host = null;
	latest = null;
});

function render(content: unknown): void {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => {
		root?.render(<Harness content={content} />);
	});
}

describe('useReadOnlyRecommendationState', () => {
	it('starts with no recommendation, no lock, no banner', () => {
		render('deck-1');
		expect(latest?.recommendation.kind).toBeNull();
		expect(latest?.locked).toBeFalsy();
		expect(latest?.bannerVisible).toBeFalsy();
	});

	it('locks editing and shows the banner once a recommendation is seeded', () => {
		render('deck-1');
		act(() => {
			latest?.setRecommendation({
				kind: 'modifyVerifier',
				messageKey: 'pptx.readOnly.modifyVerifierRecommended',
				defaultReadOnly: true,
			});
		});
		expect(latest?.locked).toBeTruthy();
		expect(latest?.bannerVisible).toBeTruthy();
	});

	it('editAnyway lifts the lock and hides the banner', () => {
		render('deck-1');
		act(() => {
			latest?.setRecommendation({
				kind: 'markedFinal',
				messageKey: 'pptx.readOnly.markedFinal',
				defaultReadOnly: true,
			});
		});
		act(() => {
			latest?.editAnyway();
		});
		expect(latest?.locked).toBeFalsy();
		expect(latest?.bannerVisible).toBeFalsy();
	});

	it('dismiss hides the banner but keeps the lock', () => {
		render('deck-1');
		act(() => {
			latest?.setRecommendation({
				kind: 'markedFinal',
				messageKey: 'pptx.readOnly.markedFinal',
				defaultReadOnly: true,
			});
		});
		act(() => {
			latest?.dismiss();
		});
		expect(latest?.locked).toBeTruthy();
		expect(latest?.bannerVisible).toBeFalsy();
	});

	it('resets the banner/edit-anyway state when content changes (next load)', () => {
		render('deck-1');
		act(() => {
			latest?.setRecommendation({
				kind: 'markedFinal',
				messageKey: 'pptx.readOnly.markedFinal',
				defaultReadOnly: true,
			});
			latest?.editAnyway();
		});
		expect(latest?.bannerVisible).toBeFalsy();

		act(() => {
			root?.render(<Harness content='deck-2' />);
		});
		// A fresh recommendation for deck-2 still needs the reset dismissal state
		// to actually show, so simulate the load setter firing for it too.
		act(() => {
			latest?.setRecommendation({
				kind: 'markedFinal',
				messageKey: 'pptx.readOnly.markedFinal',
				defaultReadOnly: true,
			});
		});
		expect(latest?.locked).toBeTruthy();
		expect(latest?.bannerVisible).toBeTruthy();
	});
});
