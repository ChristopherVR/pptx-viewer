import { COMPAT_TOAST_VISIBLE_LIMIT, compatToastStackStyle } from '../render';
import type { CompatToastsIntent, CompatToastsViewState } from '../render';
import { createChromeIcon } from './chrome-icons';
import { COMPAT_TOASTS_STYLES } from './compat-toasts-styles';
import { attachControlStyles } from './control-styles';

export type CompatToastsRequestEvent = CustomEvent<CompatToastsIntent>;
export interface PptxUiCompatToastsElement extends HTMLElement {
	state: CompatToastsViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-compat-toasts': PptxUiCompatToastsElement;
	}
}

const identity = (key: string): string => key;

/**
 * Load-diagnostic toast stack. It positions itself against the viewer root
 * (`compatToastStackStyle`, so the host must be a child of that root) and
 * clears the right-docked panel and notes strip through `rightInset` and
 * `bottomInset`. Toasts never auto-hide; dismissal is a host decision. Each
 * click emits one `compat-toasts-request` intent. The host carries
 * `data-testid="pptx-compat-toasts"`.
 */
export function definePptxCompatToasts(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-compat-toasts')) {
		return;
	}
	class CompatToasts extends HTMLElement implements PptxUiCompatToastsElement {
		private model: CompatToastsViewState = { toasts: [] };
		private signature = '';
		private readonly stack = this.ownerDocument.createElement('div');
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, COMPAT_TOASTS_STYLES);
			root.append(this.stack);
		}
		get state() {
			return this.model;
		}
		set state(value: CompatToastsViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			this.render();
		}
		private emit(intent: CompatToastsIntent): void {
			this.dispatchEvent(
				new CustomEvent('compat-toasts-request', { detail: intent, bubbles: true, composed: true }),
			);
		}
		private render(): void {
			const s = this.model;
			const t = s.translate ?? identity;
			this.dataset.testid = 'pptx-compat-toasts';
			this.hidden = s.toasts.length === 0;
			for (const [name, value] of Object.entries(
				compatToastStackStyle(s.rightInset ?? 0, s.bottomInset ?? 0),
			)) {
				this.style.setProperty(
					name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
					value,
				);
			}
			const visible = s.toasts.slice(0, COMPAT_TOAST_VISIBLE_LIMIT).map((toast) => ({
				toast,
				text: t(toast.messageKey, toast.params),
			}));
			const hiddenCount = (s.overflowCount ?? 0) + s.toasts.length - visible.length;
			const labels = [
				t('pptx.compatibility.toastTitle'),
				t('pptx.compatibility.dismissAll'),
				t('pptx.compatibility.dismiss'),
			];
			// Rebuild only when something visible changed, so a focused dismiss
			// button survives inset updates such as the notes strip resizing.
			const signature = JSON.stringify([
				labels,
				hiddenCount,
				visible.map(({ toast, text }) => [toast.id, toast.code, toast.severity, text]),
			]);
			if (signature === this.signature) {
				return;
			}
			this.signature = signature;
			const doc = this.ownerDocument;
			const header = doc.createElement('div');
			header.className = 'header';
			const heading = doc.createElement('span');
			heading.textContent = labels[0];
			const dismissAll = doc.createElement('button');
			dismissAll.type = 'button';
			dismissAll.className = 'dismiss-all';
			dismissAll.dataset.testid = 'pptx-compat-toasts-dismiss-all';
			dismissAll.textContent = labels[1];
			dismissAll.addEventListener('click', () => this.emit({ id: 'dismissAll' }));
			header.append(heading, dismissAll);
			const rows: HTMLElement[] = [header];
			for (const { toast, text } of visible) {
				const item = doc.createElement('div');
				item.className = 'toast';
				item.dataset.testid = 'pptx-compat-toast';
				item.dataset.code = toast.code;
				item.dataset.severity = toast.severity;
				item.setAttribute('role', 'status');
				const message = doc.createElement('p');
				message.className = 'message';
				message.textContent = text;
				const dismiss = doc.createElement('button');
				dismiss.type = 'button';
				dismiss.dataset.testid = 'pptx-compat-toast-dismiss';
				dismiss.setAttribute('aria-label', labels[2]);
				dismiss.append(createChromeIcon(doc, 'close'));
				dismiss.addEventListener('click', () => this.emit({ id: 'dismiss', toastId: toast.id }));
				item.append(
					createChromeIcon(doc, toast.severity === 'warning' ? 'warning' : 'info'),
					message,
					dismiss,
				);
				rows.push(item);
			}
			if (hiddenCount > 0) {
				const overflow = doc.createElement('p');
				overflow.className = 'overflow';
				overflow.textContent = `+${hiddenCount}`;
				rows.push(overflow);
			}
			this.stack.replaceChildren(...rows);
		}
	}
	registry.define('pptx-ui-compat-toasts', CompatToasts);
}
