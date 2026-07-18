/**
 * Render the staged-proposal review cards: one card per pending write with its
 * human-readable diff summary and Accept / Reject buttons, plus an Accept-all
 * action when more than one is staged. Actions call back into the panel so it
 * can apply / revert through the {@link ProposalStore} and re-render (proposal
 * changes do not flow through the chat snapshot).
 */

import type { ProposalView } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface ProposalCallbacks {
	accept(id: string): void;
	reject(id: string): void;
	acceptAll(): void;
}

/** Replace the container's children with the staged-proposal cards. */
export function renderProposals(
	doc: Document,
	container: HTMLElement,
	proposals: ProposalView[],
	t: Translator,
	callbacks: ProposalCallbacks,
): void {
	container.replaceChildren();
	container.hidden = proposals.length === 0;
	if (proposals.length === 0) {
		return;
	}

	const header = createEl(doc, 'div', 'pptxv-ai-proposals-header');
	const title = createEl(doc, 'span', 'pptxv-ai-proposals-title');
	title.textContent = t('pptx.ai.pendingChanges', { count: proposals.length });
	header.appendChild(title);
	if (proposals.length > 1) {
		const acceptAll = createEl(doc, 'button', 'pptxv-ai-proposal-btn is-accept-all');
		acceptAll.type = 'button';
		acceptAll.textContent = t('pptx.ai.acceptAll');
		acceptAll.addEventListener('click', () => callbacks.acceptAll());
		header.appendChild(acceptAll);
	}
	container.appendChild(header);

	for (const proposal of proposals) {
		container.appendChild(renderProposalCard(doc, proposal, t, callbacks));
	}
}

function renderProposalCard(
	doc: Document,
	proposal: ProposalView,
	t: Translator,
	callbacks: ProposalCallbacks,
): HTMLElement {
	const card = createEl(doc, 'div', 'pptxv-ai-proposal');
	card.dataset.proposalId = proposal.id;

	const label = createEl(doc, 'div', 'pptxv-ai-proposal-label');
	label.textContent = proposal.label;
	card.appendChild(label);

	if (proposal.summary.length > 0) {
		const list = createEl(doc, 'ul', 'pptxv-ai-proposal-summary');
		for (const line of proposal.summary.slice(0, 8)) {
			const item = createEl(doc, 'li');
			item.textContent = line;
			list.appendChild(item);
		}
		card.appendChild(list);
	}

	const actions = createEl(doc, 'div', 'pptxv-ai-proposal-actions');
	const accept = createEl(doc, 'button', 'pptxv-ai-proposal-btn is-accept');
	accept.type = 'button';
	accept.textContent = t('pptx.ai.accept');
	accept.addEventListener('click', () => callbacks.accept(proposal.id));
	const reject = createEl(doc, 'button', 'pptxv-ai-proposal-btn is-reject');
	reject.type = 'button';
	reject.textContent = t('pptx.ai.reject');
	reject.addEventListener('click', () => callbacks.reject(proposal.id));
	actions.append(accept, reject);
	card.appendChild(actions);

	return card;
}
