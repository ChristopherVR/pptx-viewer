/**
 * The AI entry point wired into the viewer chrome: a sparkles toggle button in
 * the title bar and a right-side panel host mounted as a sibling of the property
 * inspector. Everything heavy (the panel DOM builder and, through it, the
 * optional `ai` SDK) is dynamically imported only when the panel is first
 * opened, so a viewer configured with `ai` but never opened stays lean and a
 * viewer without `ai` never reaches this module at all.
 */

import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { ViewerChrome } from '../ui';
import { makeButton } from '../ui/controls';
import type { AiPanel } from './ai-panel';

export interface MountAiChatDeps {
	doc: Document;
	chrome: ViewerChrome;
	t: Translator;
	bridge: PptxAiBridge;
	config: PptxAiConfig;
}

export interface AiChatMount {
	destroy(): void;
}

/** Build the toggle button + panel host and wire lazy open/close. */
export function mountAiChat(deps: MountAiChatDeps): AiChatMount {
	const { doc, chrome, t } = deps;

	const toggle = makeButton(doc, {
		label: t('pptx.toolbar.toggleAiAssistant'),
		icon: 'sparkles',
		className: chrome.titleBar ? 'pptxv-titlebar-btn pptxv-ai-toggle' : 'pptxv-ai-toggle-floating',
		onClick: () => void toggleOpen(),
	});
	toggle.btn.setAttribute('aria-expanded', 'false');
	(chrome.titleBar?.el ?? chrome.root).appendChild(toggle.btn);

	const host = createEl(doc, 'aside', 'pptxv-ai-panel');
	host.setAttribute('aria-label', t('pptx.ai.title'));
	host.hidden = true;
	// Mount into `.pptxv-body` alongside the viewport / inspector.
	(chrome.viewport.parentElement ?? chrome.root).appendChild(host);

	let panel: AiPanel | null = null;
	let open = false;
	let loading = false;

	const toggleOpen = async (): Promise<void> => {
		open = !open;
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
			});
		} finally {
			loading = false;
			host.classList.remove('is-loading');
		}
	};

	return {
		destroy() {
			panel?.destroy();
			panel = null;
			toggle.btn.remove();
			host.remove();
		},
	};
}
