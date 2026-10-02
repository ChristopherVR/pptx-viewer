import type { ReadOnlyBannerIntent, ReadOnlyBannerViewState } from '../render';
import { createChromeIcon } from './chrome-icons';
import { attachControlStyles } from './control-styles';
import { READ_ONLY_BANNER_STYLES } from './read-only-banner-styles';

export type ReadOnlyBannerRequestEvent = CustomEvent<ReadOnlyBannerIntent>;
export interface PptxUiReadOnlyBannerElement extends HTMLElement {
	state: ReadOnlyBannerViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-read-only-banner': PptxUiReadOnlyBannerElement;
	}
}

const identity = (key: string): string => key;

/**
 * Controlled "read-only recommended" banner. Hosts own the lock (Edit anyway,
 * Dismiss, the password check); the element owns the markup, the password form
 * and its focus. Each activation emits one bubbling, composed
 * `read-only-request` event. The host carries `data-testid` and `data-kind`.
 */
export function definePptxReadOnlyBanner(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-read-only-banner')) {
		return;
	}
	class ReadOnlyBanner extends HTMLElement implements PptxUiReadOnlyBannerElement {
		private model: ReadOnlyBannerViewState = { kind: null, messageKey: '' };
		private promptWasOpen = false;
		private pendingFocus = false;
		private readonly parts = this.build();
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, READ_ONLY_BANNER_STYLES);
			root.append(this.parts.banner);
		}
		get state() {
			return this.model;
		}
		set state(value: ReadOnlyBannerViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			this.render();
			if (this.pendingFocus) {
				this.pendingFocus = false;
				this.parts.input.focus();
			}
		}
		private emit(intent: ReadOnlyBannerIntent): void {
			this.dispatchEvent(
				new CustomEvent('read-only-request', { detail: intent, bubbles: true, composed: true }),
			);
		}
		private build() {
			const doc = this.ownerDocument;
			const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '') => {
				const node = doc.createElement(tag);
				node.className = className;
				return node;
			};
			const button = (testId: string, className: string, intent: ReadOnlyBannerIntent) => {
				const node = el('button', className);
				node.type = 'button';
				node.dataset.testid = testId;
				node.addEventListener('click', () => this.emit(intent));
				return node;
			};
			const banner = el('div', 'banner');
			banner.setAttribute('role', 'status');
			banner.setAttribute('part', 'banner');
			const title = el('strong');
			const message = el('span');
			const text = el('p', 'text');
			text.append(title, ': ', message);
			const editAnyway = button('pptx-readonly-edit-anyway', 'primary', { id: 'editAnyway' });
			const dismiss = button('pptx-readonly-dismiss', '', { id: 'dismiss' });
			const form = el('form', 'form');
			form.dataset.testid = 'pptx-readonly-password-form';
			const label = el('label', 'sr-only');
			const input = el('input');
			input.id = 'password';
			input.type = 'password';
			input.dataset.testid = 'pptx-readonly-password-input';
			label.htmlFor = input.id;
			const unlock = el('button', 'primary');
			unlock.type = 'submit';
			unlock.dataset.testid = 'pptx-readonly-unlock';
			const cancel = button('pptx-readonly-password-cancel', '', { id: 'cancelPassword' });
			const error = el('span', 'error');
			error.id = 'error';
			error.setAttribute('role', 'alert');
			error.dataset.testid = 'pptx-readonly-password-error';
			form.addEventListener('submit', (event) => {
				event.preventDefault();
				this.emit({ id: 'submitPassword', password: input.value });
			});
			form.append(label, input, unlock, cancel, error);
			banner.append(createChromeIcon(doc, 'lock'), text, editAnyway, dismiss, form);
			return {
				banner,
				title,
				message,
				editAnyway,
				dismiss,
				form,
				label,
				input,
				unlock,
				cancel,
				error,
			};
		}
		private render(): void {
			const s = this.model;
			const t = s.translate ?? identity;
			const p = this.parts;
			this.dataset.testid = 'pptx-readonly-banner';
			if (s.kind) {
				this.dataset.kind = s.kind;
			} else {
				delete this.dataset.kind;
			}
			p.title.textContent = t('pptx.readOnly.bannerTitle');
			p.message.textContent = s.messageKey ? t(s.messageKey) : '';
			p.editAnyway.textContent = t('pptx.readOnly.editAnyway');
			p.dismiss.textContent = t('pptx.readOnly.dismiss');
			const open = s.passwordPromptOpen === true;
			p.editAnyway.hidden = p.dismiss.hidden = open;
			p.form.hidden = !open;
			p.label.textContent = t('pptx.readOnly.passwordLabel');
			p.input.placeholder = t('pptx.readOnly.passwordPlaceholder');
			p.unlock.textContent = t('pptx.readOnly.unlock');
			p.cancel.textContent = t('pptx.common.cancel');
			const busy = s.checkingPassword === true;
			p.input.disabled = p.unlock.disabled = busy;
			const failed = s.passwordError ?? null;
			p.input.setAttribute('aria-invalid', String(failed !== null));
			if (failed) {
				p.input.setAttribute('aria-describedby', p.error.id);
			} else {
				p.input.removeAttribute('aria-describedby');
			}
			p.error.hidden = failed === null;
			p.error.textContent = failed
				? t(
						failed === 'wrong-password'
							? 'pptx.readOnly.wrongPassword'
							: 'pptx.readOnly.unsupportedAlgorithm',
					)
				: '';
			if (open && !this.promptWasOpen) {
				if (this.isConnected) {
					p.input.focus();
				} else {
					this.pendingFocus = true;
				}
			} else if (!open && this.promptWasOpen) {
				p.input.value = '';
			}
			this.promptWasOpen = open;
		}
	}
	registry.define('pptx-ui-read-only-banner', ReadOnlyBanner);
}
