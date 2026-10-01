import { buildBarActions } from '../render';
import type { MobileBarId, MobileBarIntent, MobileBarViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { MOBILE_BAR_STYLES } from './mobile-bar-styles';
import { createMobileIcon } from './mobile-chrome-icons';

export type MobileBarRequestEvent = CustomEvent<MobileBarIntent>;
export interface PptxUiMobileBarElement extends HTMLElement {
	state: MobileBarViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-mobile-bar': PptxUiMobileBarElement;
	}
}

const identity = (key: string): string => key;

const LABEL_KEYS: Record<MobileBarId, string> = {
	slides: 'pptx.sections.slides',
	insert: 'pptx.mobileBar.insert',
	inspector: 'pptx.field.format',
	comments: 'pptx.toolbar.comments',
	notes: 'pptx.notes.title',
};

/**
 * The persistent phone bottom bar: Slides, Insert, Format, Comments and Notes.
 * Hosts keep every sheet and effect; each activation emits one bubbling, composed
 * `mobile-bar-request` intent. Everything disables with no slides, the open sheet
 * is `aria-pressed` with a top pill, and Notes is named "Toggle notes".
 */
export function definePptxMobileBar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-mobile-bar')) {
		return;
	}
	class MobileBar extends HTMLElement implements PptxUiMobileBarElement {
		private model: MobileBarViewState = { slideCount: 0 };
		private readonly nav = this.ownerDocument.createElement('nav');
		private readonly parts = buildBarActions({ slideCount: 0 }).map((descriptor) => {
			const id = descriptor.key as MobileBarId;
			const doc = this.ownerDocument;
			const button = doc.createElement('button');
			button.type = 'button';
			button.dataset.mobileAction = id;
			const label = doc.createElement('span');
			const badge = doc.createElement('span');
			badge.className = 'badge';
			badge.setAttribute('aria-hidden', 'true');
			const pill = doc.createElement('span');
			pill.className = 'pill';
			pill.setAttribute('aria-hidden', 'true');
			button.append(createMobileIcon(doc, id), label, badge, pill);
			button.addEventListener('click', () =>
				this.dispatchEvent(
					new CustomEvent<MobileBarIntent>('mobile-bar-request', {
						detail: { id },
						bubbles: true,
						composed: true,
					}),
				),
			);
			return { id, button, label, badge, pill };
		});
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, MOBILE_BAR_STYLES);
			this.nav.setAttribute('part', 'bar');
			this.nav.append(...this.parts.map((part) => part.button));
			root.append(this.nav);
		}
		get state() {
			return this.model;
		}
		set state(value: MobileBarViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			this.render();
		}
		private render(): void {
			const s = this.model;
			const t = s.translate ?? identity;
			this.nav.setAttribute('aria-label', t('pptx.mobileBar.ariaLabel'));
			const noSlides = s.slideCount === 0;
			for (const { id, button, label, badge, pill } of this.parts) {
				const active = s.activeSheet === id;
				button.hidden = s.hidden?.includes(id) === true;
				button.disabled = noSlides || s.disabled?.includes(id) === true;
				button.setAttribute('aria-pressed', String(active));
				if (id === 'notes') {
					button.setAttribute('aria-label', t('pptx.statusBar.toggleNotes'));
				}
				label.textContent = t(LABEL_KEYS[id]);
				const count = id === 'comments' ? (s.commentCount ?? 0) : 0;
				badge.hidden = count <= 0;
				badge.textContent = count > 99 ? '99+' : String(count);
				pill.hidden = !active;
			}
		}
	}
	registry.define('pptx-ui-mobile-bar', MobileBar);
}
