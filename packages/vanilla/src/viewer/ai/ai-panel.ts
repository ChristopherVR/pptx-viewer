/**
 * The AI chat panel controller. Builds the right-side panel DOM (transcript,
 * staged-proposal review cards, and a composer), creates a framework-free
 * {@link VanillaChatController} over the supplied bridge + config, and re-renders
 * on every snapshot. This module (and, through it, the optional `ai` SDK) is
 * dynamically imported by `ai-toggle.ts` only when the panel first opens.
 */

import { createVanillaChat, toolCanvasTarget, toRenderableParts } from 'pptx-viewer-shared/ai';
import type {
	PptxAiBridge,
	PptxAiConfig,
	VanillaChatController,
	VanillaChatSnapshot,
} from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from '../ui/icons';
import { createAiFocusBar } from './ai-focus-bar';
import { renderMessages } from './ai-messages';
import type { AiFocusController } from './ai-panel-controller';
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
	/** Focus / pick / highlight controller (feeds the focus bar + live focus). */
	controller?: AiFocusController;
	/** Navigate the viewer to a slide (drives the live tool focus). */
	goToSlide?(index: number): void;
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

	// Chat controller is referenced lazily by the focus bar's merge directive,
	// which only fires on a user click (well after the controller is created).
	let chat: VanillaChatController | undefined;

	// The focused-target bar (chips + pick / merge / pin controls); present only
	// when the panel was mounted with the round-3 focus controller.
	const focusController = deps.controller;
	const focusBar = focusController
		? createAiFocusBar({
				doc,
				t,
				controller: focusController,
				getSlides: () => deps.bridge.getSlides(),
				onSendDirective: (text) => void chat?.sendMessage(text),
			})
		: null;

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

	host.append(header, ...(focusBar ? [focusBar.el] : []), messages, proposals, errorLine, composer);

	try {
		chat = await (deps.createChat ?? createVanillaChat)({
			bridge: deps.bridge,
			config: deps.config,
		});
	} catch {
		empty.textContent = t('pptx.ai.unavailableTitle');
		textarea.disabled = true;
		sendBtn.disabled = true;
		focusBar?.destroy();
		return { destroy: () => host.replaceChildren() };
	}
	const controller = chat;

	// Live "AI as a collaborator" focus: as each tool call's input becomes
	// available, navigate to and flash the slide / element(s) it touches so the
	// canvas mirrors the assistant in real time. Latest-wins, flashed once each.
	const flashed = new Set<string>();
	const driveLiveFocus = (snapshot: VanillaChatSnapshot): void => {
		if (!focusController) {
			return;
		}
		const toolParts = snapshot.messages.flatMap((message) =>
			toRenderableParts(message).filter((part) => part.kind === 'tool'),
		);
		const last = toolParts.at(-1);
		if (!last || last.kind !== 'tool' || last.state === 'input-streaming') {
			return;
		}
		if (flashed.has(last.toolCallId)) {
			return;
		}
		flashed.add(last.toolCallId);
		const target = toolCanvasTarget(last.toolName, last.input);
		if (target && target.slideIndex !== undefined) {
			deps.goToSlide?.(target.slideIndex);
		}
		focusController.flashToolTarget(target);
	};

	const render = (snapshot: VanillaChatSnapshot): void => {
		renderMessages(doc, messages, snapshot.messages, t);
		empty.hidden = snapshot.messages.length > 0;
		if (snapshot.messages.length === 0) {
			messages.appendChild(empty);
		}
		renderProposals(doc, proposals, controller.proposals.list(), t, {
			accept: (id) => {
				// Applying a suggestion enables the canvas colour tween briefly so the
				// edit fades in rather than snapping (proposals apply outside the loop).
				focusController?.flashToolTarget(null);
				controller.proposals.apply(id);
				render(controller.getSnapshot());
			},
			reject: (id) => {
				controller.proposals.revert(id);
				render(controller.getSnapshot());
			},
			acceptAll: () => {
				focusController?.flashToolTarget(null);
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
		driveLiveFocus(snapshot);
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

	// Apply a one-shot composer prefill from "Ask AI" / "Fix with AI" / pick mode:
	// fill the composer and focus it (never auto-send) when the nonce advances.
	let lastPrefillNonce = focusController?.getPrefill().nonce ?? 0;
	const applyPrefill = (): void => {
		if (!focusController) {
			return;
		}
		const prefill = focusController.getPrefill();
		if (prefill.nonce === lastPrefillNonce) {
			return;
		}
		lastPrefillNonce = prefill.nonce;
		textarea.value = prefill.text;
		textarea.focus();
	};
	const unsubscribeFocus = focusController?.subscribe(applyPrefill);

	const unsubscribe = controller.subscribe(render);
	render(controller.getSnapshot());

	return {
		destroy() {
			unsubscribe();
			unsubscribeFocus?.();
			focusBar?.destroy();
			host.replaceChildren();
		},
	};
}
