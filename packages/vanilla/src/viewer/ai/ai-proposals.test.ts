import type { ProposalView } from 'pptx-viewer-shared/ai';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { renderProposals } from './ai-proposals';

const t = createTranslator('en');

function proposal(overrides: Partial<ProposalView> = {}): ProposalView {
	return {
		id: 'p1',
		label: 'Recolour the title',
		summary: Array.from({ length: 12 }, (_, i) => `line ${i + 1}`),
		...overrides,
	} as ProposalView;
}

describe('renderProposals round-3 cards', () => {
	it('shows a "Suggested change" eyebrow and renders every summary line untruncated', () => {
		const host = document.createElement('div');
		renderProposals(document, host, [proposal()], t, {
			accept: () => undefined,
			reject: () => undefined,
			acceptAll: () => undefined,
		});

		expect(host.querySelector('.pptxv-ai-proposal-eyebrow')?.textContent).toBe('Suggested change');
		// The old panel clipped the summary at 8 lines; round-3 shows all 12.
		expect(host.querySelectorAll('.pptxv-ai-proposal-summary li')).toHaveLength(12);
		// Friendly Apply / Discard labels.
		expect(host.querySelector('.pptxv-ai-proposal-btn.is-accept')?.textContent).toContain('Apply');
		expect(host.querySelector('.pptxv-ai-proposal-btn.is-reject')?.textContent).toContain(
			'Discard',
		);
	});

	it('routes Apply / Discard through the callbacks', () => {
		const host = document.createElement('div');
		const accept = vi.fn();
		const reject = vi.fn();
		renderProposals(document, host, [proposal({ summary: [] })], t, {
			accept,
			reject,
			acceptAll: () => undefined,
		});
		host.querySelector<HTMLButtonElement>('.pptxv-ai-proposal-btn.is-accept')?.click();
		host.querySelector<HTMLButtonElement>('.pptxv-ai-proposal-btn.is-reject')?.click();
		expect(accept).toHaveBeenCalledWith('p1');
		expect(reject).toHaveBeenCalledWith('p1');
	});
});
