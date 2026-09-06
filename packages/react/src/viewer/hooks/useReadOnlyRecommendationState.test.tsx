// @vitest-environment happy-dom
import { createModifyVerifier } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useReadOnlyRecommendationState } from './useReadOnlyRecommendationState';
import type { UseReadOnlyRecommendationStateResult } from './useReadOnlyRecommendationState';

async function flush(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
	});
}

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
				requiresPassword: false,
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
				requiresPassword: false,
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
				requiresPassword: false,
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
				requiresPassword: false,
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
				requiresPassword: false,
			});
		});
		expect(latest?.locked).toBeTruthy();
		expect(latest?.bannerVisible).toBeTruthy();
	});

	describe('password-protected modifyVerifier', () => {
		it('editAnyway opens the password prompt instead of unlocking', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			render('deck-1');
			act(() => {
				latest?.setModifyVerifier(verifier);
				latest?.setRecommendation({
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					defaultReadOnly: true,
					requiresPassword: true,
				});
			});
			act(() => {
				latest?.editAnyway();
			});
			expect(latest?.passwordPromptOpen).toBeTruthy();
			// Opening the prompt must not lift the lock by itself.
			expect(latest?.locked).toBeTruthy();
			expect(latest?.bannerVisible).toBeTruthy();
		});

		it('submitPassword with the correct password unlocks and closes the prompt', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			render('deck-1');
			act(() => {
				latest?.setModifyVerifier(verifier);
				latest?.setRecommendation({
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					defaultReadOnly: true,
					requiresPassword: true,
				});
			});
			// A separate act() so `editAnyway` closes over the just-committed
			// recommendation (React does not re-render mid-callback).
			act(() => {
				latest?.editAnyway();
			});

			await act(async () => {
				await latest?.submitPassword('right-password');
			});

			expect(latest?.locked).toBeFalsy();
			expect(latest?.passwordPromptOpen).toBeFalsy();
			expect(latest?.passwordError).toBeNull();
			expect(latest?.bannerVisible).toBeFalsy();
		});

		it('submitPassword with a wrong password stays locked and reports wrong-password', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			render('deck-1');
			act(() => {
				latest?.setModifyVerifier(verifier);
				latest?.setRecommendation({
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					defaultReadOnly: true,
					requiresPassword: true,
				});
			});
			// A separate act() so `editAnyway` closes over the just-committed
			// recommendation (React does not re-render mid-callback).
			act(() => {
				latest?.editAnyway();
			});

			await act(async () => {
				await latest?.submitPassword('wrong-password');
			});

			expect(latest?.locked).toBeTruthy();
			expect(latest?.passwordPromptOpen).toBeTruthy();
			expect(latest?.passwordError).toBe('wrong-password');
			await flush();
		});

		it('cancelPasswordPrompt closes the prompt without unlocking', async () => {
			const verifier = await createModifyVerifier('right-password', { spinCount: 10 });
			render('deck-1');
			act(() => {
				latest?.setModifyVerifier(verifier);
				latest?.setRecommendation({
					kind: 'modifyVerifier',
					messageKey: 'pptx.readOnly.modifyVerifierRecommended',
					defaultReadOnly: true,
					requiresPassword: true,
				});
			});
			// A separate act() so `editAnyway` closes over the just-committed
			// recommendation (React does not re-render mid-callback).
			act(() => {
				latest?.editAnyway();
			});
			act(() => {
				latest?.cancelPasswordPrompt();
			});
			expect(latest?.passwordPromptOpen).toBeFalsy();
			expect(latest?.locked).toBeTruthy();
			expect(latest?.bannerVisible).toBeTruthy();
		});
	});
});
