/**
 * The AI entry point wired into the viewer chrome: a sparkles toggle button in
 * the title bar and a right-side panel host mounted as a sibling of the property
 * inspector. Everything heavy (the panel DOM builder and, through it, the
 * optional `ai` SDK) is dynamically imported only when the panel is first
 * opened, so a viewer configured with `ai` but never opened stays lean and a
 * viewer without `ai` never reaches this module at all.
 *
 * The on-canvas round-3 affordances that must work even before the panel opens
 * (the pick-mode click interceptor and the focus/tool highlight overlay) are
 * mounted eagerly against the framework-free {@link AiFocusController}.
 */

import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';
import type { ViewerChrome } from '../ui';
import { makeButton } from '../ui/controls';
import { mountAiChangeOverlay } from './ai-change-overlay';
import type { AiChangeOverlay } from './ai-change-overlay';
import { mountAiContextMenu } from './ai-context-menu';
import { mountAiHighlightOverlay } from './ai-highlight-overlay';
import type { AiPanel } from './ai-panel';
import type { AiFocusController } from './ai-panel-controller';
import { mountAiPickInterception } from './ai-pick-interception';

export interface MountAiChatDeps {
	doc: Document;
	chrome: ViewerChrome;
	t: Translator;
	bridge: PptxAiBridge;
	config: PptxAiConfig;
	store: Store<ViewerState>;
	/** Focus / pick / highlight controller shared with the bridge. */
	controller: AiFocusController;
	/** Navigate the viewer to a slide (used by the live tool focus). */
	goToSlide(index: number): void;
}

export interface AiChatMount {
	/** Open the panel (used by pick mode / Ask AI / Fix with AI). */
	open(): void;
	destroy(): void;
}

/** The live `.pptxv-stage` node inside the stage wrap (rebuilt on each render). */
function stageRootOf(chrome: ViewerChrome): HTMLElement | null {
	return chrome.stageWrap.querySelector<HTMLElement>('.pptxv-stage');
}

/** Build the toggle button + panel host and wire lazy open/close. */
export function mountAiChat(deps: MountAiChatDeps): AiChatMount {
	const { doc, chrome, t, controller } = deps;
	const getStageRoot = (): HTMLElement | null => stageRootOf(chrome);

	const toggle = makeButton(doc, {
		label: t('pptx.toolbar.toggleAiAssistant'),
		icon: 'sparkles',
		className: chrome.titleBar ? 'pptxv-titlebar-btn pptxv-ai-toggle' : 'pptxv-ai-toggle-floating',
		onClick: () => void setOpen(!open),
	});
	toggle.btn.setAttribute('aria-expanded', 'false');
	(chrome.titleBar?.el ?? chrome.root).appendChild(toggle.btn);

	const host = createEl(doc, 'aside', 'pptxv-ai-panel');
	host.setAttribute('aria-label', t('pptx.ai.title'));
	host.hidden = true;
	// Mount into `.pptxv-body` alongside the viewport / inspector.
	(chrome.viewport.parentElement ?? chrome.root).appendChild(host);

	// On-canvas affordances live for as long as `ai` is configured.
	const overlay = mountAiHighlightOverlay({ doc, store: deps.store, controller, getStageRoot });
	const picker = mountAiPickInterception({
		viewport: chrome.viewport,
		store: deps.store,
		controller,
		getStageRoot,
	});
	const contextMenu = mountAiContextMenu({
		doc,
		t,
		store: deps.store,
		controller,
		viewport: chrome.viewport,
		getStageRoot,
	});

	let panel: AiPanel | null = null;
	let changeOverlay: AiChangeOverlay | null = null;
	let open = false;
	let loading = false;

	const setOpen = async (next: boolean): Promise<void> => {
		open = next;
		host.hidden = !open;
		toggle.setActive(open);
		toggle.btn.setAttribute('aria-expanded', String(open));
		if (!open || panel || loading) {
			return;
		}
		loading = true;
		host.classList.add('is-loading');
		try {
			const { createAiPanel } = await import('./ai-panel');
			panel = await createAiPanel({
				host,
				doc,
				t,
				bridge: deps.bridge,
				config: deps.config,
				controller,
				goToSlide: deps.goToSlide,
			});
			// Once the session exists, play applied AI edits on the canvas: reveal
			// the changed slide and glide/fade a ghost per changed element.
			if (panel.changeAnimator) {
				changeOverlay = mountAiChangeOverlay({
					doc,
					store: deps.store,
					animator: panel.changeAnimator,
					getStageRoot,
					goToSlide: deps.goToSlide,
				});
			}
		} finally {
			loading = false;
			host.classList.remove('is-loading');
		}
	};

	return {
		open() {
			void setOpen(true);
		},
		destroy() {
			changeOverlay?.destroy();
			changeOverlay = null;
			panel?.destroy();
			panel = null;
			contextMenu.destroy();
			picker.destroy();
			overlay.destroy();
			controller.dispose();
			toggle.btn.remove();
			host.remove();
		},
	};
}
