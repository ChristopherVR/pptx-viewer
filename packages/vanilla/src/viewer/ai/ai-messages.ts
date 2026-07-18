/**
 * Render the AI chat transcript: user / assistant text bubbles plus compact
 * tool-call cards. Pure DOM assembly against an explicit `Document`; the panel
 * controller owns the container and calls {@link renderMessages} on every
 * snapshot change.
 */

import type { PptxAiUIMessage } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/** A structurally-narrowed message part (the SDK union is opaque here). */
interface RawPart {
	type: string;
	text?: unknown;
	toolName?: unknown;
	state?: unknown;
	errorText?: unknown;
}

function partsOf(message: PptxAiUIMessage): RawPart[] {
	return (message.parts ?? []) as unknown as RawPart[];
}

function textOf(part: RawPart): string {
	return typeof part.text === 'string' ? part.text : '';
}

/** Human-readable tool name from a `tool-<name>` / `dynamic-tool` part. */
function toolNameOf(part: RawPart): string {
	if (part.type === 'dynamic-tool') {
		return typeof part.toolName === 'string' ? part.toolName : 'tool';
	}
	return part.type.slice('tool-'.length);
}

function isToolPart(part: RawPart): boolean {
	return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

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
		const row = createEl(doc, 'div', `pptxv-ai-msg pptxv-ai-msg-${message.role}`);
		const role = createEl(doc, 'div', 'pptxv-ai-msg-role');
		role.textContent = t(message.role === 'user' ? 'pptx.ai.you' : 'pptx.ai.assistant');
		row.appendChild(role);

		for (const part of partsOf(message)) {
			if (part.type === 'text') {
				const text = textOf(part);
				if (!text) {
					continue;
				}
				const body = createEl(doc, 'div', 'pptxv-ai-msg-text');
				body.textContent = text;
				row.appendChild(body);
			} else if (isToolPart(part)) {
				row.appendChild(renderToolCard(doc, part, t));
			}
		}
		// Skip an assistant row that ended up with only its role label (e.g. a
		// bare tool step already surfaced as a card above it).
		if (row.childElementCount > 1 || message.role === 'user') {
			container.appendChild(row);
		}
	}
}

function renderToolCard(doc: Document, part: RawPart, t: Translator): HTMLElement {
	const card = createEl(doc, 'div', 'pptxv-ai-tool');
	const name = createEl(doc, 'span', 'pptxv-ai-tool-name');
	name.textContent = toolNameOf(part);
	card.appendChild(name);
	const state = typeof part.state === 'string' ? part.state : '';
	const status = createEl(doc, 'span', 'pptxv-ai-tool-state');
	if (state === 'output-error') {
		status.classList.add('is-error');
		status.textContent =
			typeof part.errorText === 'string' && part.errorText
				? part.errorText
				: t('pptx.ai.toolFailed');
	} else {
		status.textContent =
			state === 'output-available' ? t('pptx.ai.toolDone') : t('pptx.ai.toolRunning');
	}
	card.appendChild(status);
	return card;
}
