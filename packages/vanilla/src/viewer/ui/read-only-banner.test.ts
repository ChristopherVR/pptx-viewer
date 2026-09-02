import type { ReadOnlyRecommendation } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createReadOnlyBanner } from './read-only-banner';

function mount() {
	const onEditAnyway = vi.fn();
	const onDismiss = vi.fn();
	const banner = createReadOnlyBanner(document, (key) => key, onEditAnyway, onDismiss);
	return { banner, onEditAnyway, onDismiss };
}

const MODIFY_VERIFIER: ReadOnlyRecommendation = {
	kind: 'modifyVerifier',
	messageKey: 'pptx.readOnly.modifyVerifierRecommended',
	defaultReadOnly: true,
};

const MARKED_FINAL: ReadOnlyRecommendation = {
	kind: 'markedFinal',
	messageKey: 'pptx.readOnly.markedFinal',
	defaultReadOnly: true,
};

describe('read-only recommendation banner', () => {
	it('starts hidden', () => {
		const { banner } = mount();

		expect(banner.el.hidden).toBeTruthy();
	});

	it('shows the modifyVerifier recommendation with its kind and message', () => {
		const { banner } = mount();

		banner.update(MODIFY_VERIFIER, false);

		expect(banner.el.hidden).toBeFalsy();
		expect(banner.el.dataset.kind).toBe('modifyVerifier');
		expect(banner.el.textContent).toContain('pptx.readOnly.modifyVerifierRecommended');
	});

	it('shows the markedFinal recommendation with its own kind and message', () => {
		const { banner } = mount();

		banner.update(MARKED_FINAL, false);

		expect(banner.el.dataset.kind).toBe('markedFinal');
		expect(banner.el.textContent).toContain('pptx.readOnly.markedFinal');
	});

	it('stays hidden when there is no recommendation', () => {
		const { banner } = mount();

		banner.update(null, false);

		expect(banner.el.hidden).toBeTruthy();
	});

	it('hides when dismissed even with a live recommendation', () => {
		const { banner } = mount();

		banner.update(MODIFY_VERIFIER, true);

		expect(banner.el.hidden).toBeTruthy();
	});

	it('fires onEditAnyway from the edit-anyway button', () => {
		const { banner, onEditAnyway } = mount();
		banner.update(MODIFY_VERIFIER, false);

		banner.el
			.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-edit-anyway"]')!
			.click();

		expect(onEditAnyway).toHaveBeenCalledOnce();
	});

	it('fires onDismiss from the dismiss button', () => {
		const { banner, onDismiss } = mount();
		banner.update(MODIFY_VERIFIER, false);

		banner.el.querySelector<HTMLButtonElement>('[data-testid="pptx-readonly-dismiss"]')!.click();

		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it('carries the pptx-readonly-banner testid', () => {
		const { banner } = mount();

		expect(banner.el.dataset.testid).toBe('pptx-readonly-banner');
	});
});
