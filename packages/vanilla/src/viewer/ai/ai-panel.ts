/**
 * The AI chat panel controller. Builds the right-side panel DOM (transcript,
 * staged-proposal review cards, and a composer), creates a framework-free
 * {@link VanillaChatController} over the supplied bridge + config, and re-renders
 * on every snapshot. This module (and, through it, the optional `ai` SDK) is
 * dynamically imported by `ai-toggle.ts` only when the panel first opens.
 */

import { createVanillaChat } from 'pptx-viewer-shared/ai';
import type {
	PptxAiBridge,
	PptxAiConfig,
	VanillaChatController,
	VanillaChatSnapshot,
} from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from '../ui/icons';
import { renderMessages } from './ai-messages';
import { renderProposals } from './ai-proposals';

/** Factory matching {@link createVanillaChat}; overridable for tests. */
export type ChatFactory = (options: {
	bridge: PptxAiBridge;
	config: PptxAiConfig;
}) => Promise<VanillaChatController>;

export interface AiPanelDeps {
	host: HTMLElement;
	doc: Document;
	t: Translator;
	bridge: PptxAiBridge;
	config: PptxAiConfig;
	/** Defaults to the shared {@link createVanillaChat}. */
	createChat?: ChatFactory;
}

export interface AiPanel {
	destroy(): void;
}

/** Build the panel, wire the controller, and return a disposable handle. */
export async function createAiPanel(deps: AiPanelDeps): Promise<AiPanel> {
	const { doc, host, t } = deps;
	host.replaceChildren();

	const header = createEl(doc, 'div', 'pptxv-ai-header');
	const title = createEl(doc, 'span', 'pptxv-ai-title');
	title.textContent = t('pptx.ai.title');
	header.append(createIcon(doc, 'sparkles'), title);

	const messages = createEl(doc, 'div', 'pptxv-ai-messages');
	messages.setAttribute('role', 'log');
	messages.setAttribute('aria-live', 'polite');
	const empty = createEl(doc, 'div', 'pptxv-ai-empty');
	empty.textContent = t('pptx.ai.emptyHint');
	messages.appendChild(empty);

	const proposals = createEl(doc, 'div', 'pptxv-ai-proposals');
	proposals.hidden = true;
	const errorLine = createEl(doc, 'div', 'pptxv-ai-error');
	errorLine.setAttribute('role', 'alert');
	errorLine.hidden = true;

	const composer = createEl(doc, 'form', 'pptxv-ai-composer');
	const textarea = createEl(doc, 'textarea', 'pptxv-ai-input');
	textarea.rows = 2;
	textarea.placeholder = t('pptx.ai.placeholder');
	const sendBtn = createEl(doc, 'button', 'pptxv-ai-send');
	sendBtn.type = 'submit';
	sendBtn.setAttribute('aria-label', t('pptx.ai.send'));
	sendBtn.appendChild(createIcon(doc, 'send'));
	composer.append(textarea, sendBtn);

	host.append(header, messages, proposals, errorLine, composer);

	let controller: VanillaChatController;
	try {
		controller = await (deps.createChat ?? createVanillaChat)({
			bridge: deps.bridge,
			config: deps.config,
		});
	} catch {
		empty.textContent = t('pptx.ai.unavailableTitle');
		textarea.disabled = true;
		sendBtn.disabled = true;
		return { destroy: () => host.replaceChildren() };
	}

	const render = (snapshot: VanillaChatSnapshot): void => {
		renderMessages(doc, messages, snapshot.messages, t);
		empty.hidden = snapshot.messages.length > 0;
		if (snapshot.messages.length === 0) {
			messages.appendChild(empty);
		}
		renderProposals(doc, proposals, controller.proposals.list(), t, {
			accept: (id) => {
				controller.proposals.apply(id);
				render(controller.getSnapshot());
			},
			reject: (id) => {
				controller.proposals.revert(id);
				render(controller.getSnapshot());
			},
			acceptAll: () => {
				controller.proposals.acceptAll();
				render(controller.getSnapshot());
			},
		});
		const busy = snapshot.status === 'submitted' || snapshot.status === 'streaming';
		host.classList.toggle('is-busy', busy);
		sendBtn.setAttribute('aria-label', t(busy ? 'pptx.ai.stop' : 'pptx.ai.send'));
		errorLine.hidden = !snapshot.error;
		errorLine.textContent = snapshot.error ? t('pptx.ai.errorPrefix') : '';
		messages.scrollTop = messages.scrollHeight;
	};

	const submit = (): void => {
		if (host.classList.contains('is-busy')) {
			void controller.stop();
			return;
		}
		const text = textarea.value.trim();
		if (!text) {
			return;
		}
		textarea.value = '';
		void controller.sendMessage(text);
	};

	composer.addEventListener('submit', (event) => {
		event.preventDefault();
		submit();
	});
	textarea.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			submit();
		}
	});

	const unsubscribe = controller.subscribe(render);
	render(controller.getSnapshot());

	return {
		destroy() {
			unsubscribe();
			host.replaceChildren();
		},
	};
}
