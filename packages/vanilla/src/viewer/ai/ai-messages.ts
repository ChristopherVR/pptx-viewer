/**
 * Render the AI chat transcript: user / assistant turns with a small avatar,
 * prose bubbles (never truncated), and inline friendly tool-call cards. The
 * message model is flattened by the shared {@link toRenderableParts} so every
 * binding renders an identical transcript; the per-tool "activity" phrasing
 * lives in {@link renderToolCard}. Pure DOM assembly against an explicit
 * `Document`; the panel controller calls this on every snapshot change.
 */

import type { PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { toRenderableParts } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from '../ui/icons';
import { renderToolCard } from './ai-tool-card';

/** Replace the container's children with the rendered transcript. */
export function renderMessages(
	doc: Document,
	container: HTMLElement,
	messages: PptxAiUIMessage[],
	t: Translator,
): void {
	container.replaceChildren();
	for (const message of messages) {
		if (message.role === 'system') {
			continue;
		}
		const isUser = message.role === 'user';
		const parts = toRenderableParts(message);
		// Skip an assistant turn that produced no renderable content (e.g. a bare
		// tool step already surfaced as a card in the previous turn).
		if (parts.length === 0 && !isUser) {
			continue;
		}

		const row = createEl(doc, 'div', `pptxv-ai-msg pptxv-ai-msg-${message.role}`);
		const avatar = createEl(doc, 'div', 'pptxv-ai-msg-avatar');
		avatar.setAttribute('aria-label', t(isUser ? 'pptx.ai.you' : 'pptx.ai.assistant'));
		avatar.appendChild(createIcon(doc, isUser ? 'comment' : 'sparkles'));
		const body = createEl(doc, 'div', 'pptxv-ai-msg-body');

		for (const part of parts) {
			if (part.kind === 'text') {
				const text = createEl(doc, 'div', 'pptxv-ai-msg-text');
				text.textContent = part.text;
				body.appendChild(text);
			} else {
				body.appendChild(renderToolCard(doc, part, t));
			}
		}

		row.append(avatar, body);
		container.appendChild(row);
	}
}
