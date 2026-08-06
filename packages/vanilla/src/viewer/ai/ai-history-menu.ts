/**
 * Chat-history affordance for the Vanilla AI panel: a header "Chats" toggle
 * button plus the saved-chat dropdown (resume / delete / New chat / hint),
 * backed by the shared framework-free `createAiChatHistoryController`. The
 * panel inserts the button into its header, appends the dropdown to its root,
 * and forwards transcript changes through {@link AiHistoryMenu.notifyMessagesChanged}
 * for the debounced per-deck auto-save. Mirrors the React binding's
 * AiHistoryMenu / AiHistoryList.
 */

import { createAiChatHistoryController } from 'pptx-viewer-shared/ai';
import type { PptxAiChatStore, PptxAiUIMessage } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from '../ui/icons';

export interface AiHistoryMenuDeps {
	doc: Document;
	t: Translator;
	/** Deck the chats are scoped to (see the shared `deckIdFromBridge`). */
	deckId: string;
	/** Read the live transcript from the chat controller. */
	getMessages(): PptxAiUIMessage[];
	/** Replace the transcript (resume / new chat / delete-active). */
	setMessages(messages: PptxAiUIMessage[]): void;
	/** Injectable for tests; defaults to the shared IndexedDB-first store. */
	store?: PptxAiChatStore;
}

export interface AiHistoryMenu {
	/** The header "Chats" toggle; the host inserts it into the panel header. */
	button: HTMLButtonElement;
	/** The dropdown (hidden until toggled); the host appends it to the panel. */
	el: HTMLElement;
	/** Debounced (800ms) save of the current transcript (empty ones skipped). */
	notifyMessagesChanged(): void;
	destroy(): void;
}

/** Build the "Chats" button + saved-chat dropdown and wire persistence. */
export function createAiHistoryMenu(deps: AiHistoryMenuDeps): AiHistoryMenu {
	const { doc, t } = deps;

	const button = createEl(doc, 'button', 'pptxv-ai-chats');
	button.type = 'button';
	button.append(createIcon(doc, 'history'), doc.createTextNode(t('pptx.ai.chats')));

	const el = createEl(doc, 'div', 'pptxv-ai-history');
	el.hidden = true;

	const head = createEl(doc, 'div', 'pptxv-ai-history-head');
	const title = createEl(doc, 'span', 'pptxv-ai-history-title');
	title.textContent = t('pptx.ai.historyTitle');
	const newBtn = createEl(doc, 'button', 'pptxv-ai-history-new');
	newBtn.type = 'button';
	newBtn.append(createIcon(doc, 'plus'), doc.createTextNode(t('pptx.ai.newChat')));
	head.append(title, newBtn);

	const listWrap = createEl(doc, 'div', 'pptxv-ai-history-body');
	const hint = createEl(doc, 'p', 'pptxv-ai-history-hint');
	hint.textContent = t('pptx.ai.historyHint');
	el.append(head, listWrap, hint);

	const controller = createAiChatHistoryController({
		deckId: deps.deckId,
		store: deps.store,
		getMessages: deps.getMessages,
		setMessages: deps.setMessages,
		untitledLabel: t('pptx.ai.untitledChat'),
		onChatsChanged: () => renderList(),
	});

	function renderList(): void {
		listWrap.replaceChildren();
		const chats = controller.chats();
		if (chats.length === 0) {
			const empty = createEl(doc, 'p', 'pptxv-ai-history-empty');
			empty.textContent = t('pptx.ai.historyEmpty');
			listWrap.appendChild(empty);
			return;
		}
		const list = createEl(doc, 'ul', 'pptxv-ai-history-list');
		for (const chat of chats) {
			const row = createEl(doc, 'li', 'pptxv-ai-history-row');
			const resume = createEl(doc, 'button', 'pptxv-ai-history-resume');
			resume.type = 'button';
			resume.classList.toggle('is-active', chat.id === controller.activeChatId());
			const text = createEl(doc, 'span', 'pptxv-ai-history-text');
			const name = createEl(doc, 'span', 'pptxv-ai-history-name');
			name.textContent = chat.title || t('pptx.ai.untitledChat');
			const meta = createEl(doc, 'span', 'pptxv-ai-history-meta');
			meta.textContent = t('pptx.ai.messageCount', { count: chat.messageCount });
			text.append(name, meta);
			resume.append(createIcon(doc, 'comment'), text);
			resume.addEventListener('click', () => {
				void controller.resumeChat(chat.id);
				el.hidden = true;
			});
			const del = createEl(doc, 'button', 'pptxv-ai-history-delete');
			del.type = 'button';
			del.title = t('pptx.ai.deleteChat');
			del.setAttribute('aria-label', t('pptx.ai.deleteChat'));
			del.appendChild(createIcon(doc, 'trash'));
			del.addEventListener('click', () => void controller.deleteChat(chat.id));
			row.append(resume, del);
			list.appendChild(row);
		}
		listWrap.appendChild(list);
	}
	renderList();

	button.addEventListener('click', () => {
		el.hidden = !el.hidden;
	});
	newBtn.addEventListener('click', () => {
		controller.newChat();
		el.hidden = true;
	});

	// Close on outside click (the toggle itself flips the state instead).
	const onDocMouseDown = (event: MouseEvent): void => {
		if (el.hidden || !(event.target instanceof Node)) {
			return;
		}
		if (!el.contains(event.target) && !button.contains(event.target)) {
			el.hidden = true;
		}
	};
	doc.addEventListener('mousedown', onDocMouseDown);

	return {
		button,
		el,
		notifyMessagesChanged: () => controller.notifyMessagesChanged(),
		destroy() {
			doc.removeEventListener('mousedown', onDocMouseDown);
			controller.dispose();
			button.remove();
			el.remove();
		},
	};
}
