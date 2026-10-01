import type { MobileToolbarId, MobileToolbarIntent, MobileToolbarViewState } from '../render';
import { attachControlStyles } from './control-styles';
import { MOBILE_TOOLBAR_STYLES } from './mobile-bar-styles';
import { createMobileIcon } from './mobile-chrome-icons';
import type { MobileIcon } from './mobile-chrome-icons';

export type MobileToolbarRequestEvent = CustomEvent<MobileToolbarIntent>;
export interface PptxUiMobileToolbarElement extends HTMLElement {
	state: MobileToolbarViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-mobile-toolbar': PptxUiMobileToolbarElement;
	}
}

const identity = (key: string): string => key;

const ORDER: readonly {
	id: MobileToolbarId;
	icon: MobileIcon;
	labelKey: string;
	className: string;
}[] = [
	{ id: 'menu', icon: 'menu', labelKey: 'pptx.mobileToolbar.menu', className: '' },
	{ id: 'undo', icon: 'undo', labelKey: 'pptx.toolbar.undo', className: '' },
	{ id: 'redo', icon: 'redo', labelKey: 'pptx.toolbar.redo', className: '' },
	{ id: 'ai', icon: 'ai', labelKey: 'pptx.toolbar.toggleAiAssistant', className: '' },
	{ id: 'save', icon: 'save', labelKey: 'pptx.toolbar.save', className: '' },
	{ id: 'present', icon: 'present', labelKey: 'pptx.toolbar.present', className: 'present' },
	{ id: 'share', icon: 'share', labelKey: 'pptx.toolbar.share', className: 'share' },
];

const EDIT_ONLY: readonly MobileToolbarId[] = ['menu', 'undo', 'redo', 'ai', 'share'];

/**
 * The compact phone top toolbar: Menu, Undo, Redo, an optional AI toggle, Save,
 * Present and Share. Hosts keep the menu sheet, history, save, present and share
 * dialog; each activation emits one bubbling, composed `mobile-toolbar-request`
 * intent. Host-owned controls (a collaboration indicator, or an AI mount point
 * when the host draws its own toggle) go in the `ai` and `collaboration` slots,
 * which hide together with the editing-only buttons.
 */
export function definePptxMobileToolbar(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-mobile-toolbar')) {
		return;
	}
	class MobileToolbar extends HTMLElement implements PptxUiMobileToolbarElement {
		private model: MobileToolbarViewState = { editable: false, canUndo: false, canRedo: false };
		private readonly bar = this.ownerDocument.createElement('div');
		private readonly aiSlot = this.ownerDocument.createElement('slot');
		private readonly collaborationSlot = this.ownerDocument.createElement('slot');
		private readonly buttons = new Map<MobileToolbarId, HTMLButtonElement>(
			ORDER.map(({ id, icon, className }) => {
				const button = this.ownerDocument.createElement('button');
				button.type = 'button';
				button.className = className;
				button.dataset.mobileToolbar = id;
				button.append(createMobileIcon(this.ownerDocument, icon));
				button.addEventListener('click', () =>
					this.dispatchEvent(
						new CustomEvent<MobileToolbarIntent>('mobile-toolbar-request', {
							detail: { id },
							bubbles: true,
							composed: true,
						}),
					),
				);
				return [id, button] as const;
			}),
		);
		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, MOBILE_TOOLBAR_STYLES);
			const spacer = this.ownerDocument.createElement('span');
			spacer.className = 'spacer';
			this.aiSlot.name = 'ai';
			this.collaborationSlot.name = 'collaboration';
			const b = (id: MobileToolbarId) => this.buttons.get(id)!;
			this.bar.className = 'bar';
			this.bar.setAttribute('role', 'toolbar');
			this.bar.setAttribute('part', 'bar');
			this.bar.append(
				b('menu'),
				b('undo'),
				b('redo'),
				spacer,
				b('ai'),
				this.aiSlot,
				b('save'),
				b('present'),
				b('share'),
				this.collaborationSlot,
			);
			root.append(this.bar);
		}
		get state() {
			return this.model;
		}
		set state(value: MobileToolbarViewState) {
			this.model = value;
			this.render();
		}
		connectedCallback(): void {
			this.render();
		}
		private render(): void {
			const s = this.model;
			const t = s.translate ?? identity;
			this.bar.setAttribute('aria-label', t('pptx.mobileToolbar.toolbar'));
			for (const { id, labelKey } of ORDER) {
				const button = this.buttons.get(id)!;
				const text = t(labelKey);
				button.title = text;
				button.setAttribute('aria-label', text);
				button.hidden =
					s.hidden?.includes(id) === true ||
					(EDIT_ONLY.includes(id) && !s.editable) ||
					(id === 'ai' && s.aiVisible !== true);
				button.disabled =
					s.disabled?.includes(id) === true ||
					(id === 'undo' && !s.canUndo) ||
					(id === 'redo' && !s.canRedo);
			}
			this.buttons.get('ai')!.setAttribute('aria-pressed', String(s.aiActive === true));
			const menu = this.buttons.get('menu')!;
			if (s.menuOpen === undefined) {
				menu.removeAttribute('aria-expanded');
			} else {
				menu.setAttribute('aria-expanded', String(s.menuOpen));
			}
			this.aiSlot.hidden = this.collaborationSlot.hidden = !s.editable;
		}
	}
	registry.define('pptx-ui-mobile-toolbar', MobileToolbar);
}
