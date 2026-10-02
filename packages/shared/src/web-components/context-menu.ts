import { clampFlyoutPosition } from '../render/flyout-position';
import type {
	ContextMenuCloseDetail,
	ContextMenuCloseReason,
	ContextMenuRequestDetail,
	ContextMenuViewState,
} from './context-menu-model';
import {
	CONTEXT_MENU_EDITOR_LAYER,
	EMPTY_CONTEXT_MENU_STATE,
	isMarkerName,
	nextEnabledIndex,
	typeAheadIndex,
} from './context-menu-model';
import { CONTEXT_MENU_STYLES } from './context-menu-styles';
import { createContextMenuView } from './context-menu-view';
import { attachControlStyles } from './control-styles';

export type ContextMenuRequestEvent = CustomEvent<ContextMenuRequestDetail>;
export type ContextMenuCloseEvent = CustomEvent<ContextMenuCloseDetail>;
export interface PptxUiContextMenuElement extends HTMLElement {
	state: ContextMenuViewState;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-context-menu': PptxUiContextMenuElement;
	}
}

/** Open menus per document, innermost last: Escape closes only the top one. */
const openMenus = new WeakMap<Document, HTMLElement[]>();
const TYPE_AHEAD_MS = 700;

/**
 * Controlled pointer-anchored menu. The host supplies translated rows and
 * gating through `state`, owns every effect, and closes the menu by removing
 * the element or clearing its items. The element emits bubbling, composed
 * `menu-request { id }` when a row is activated and `menu-close { reason }`
 * when the user dismisses it (Escape, outside press, Tab). It never closes
 * itself, so a host that wants to keep the menu open can.
 *
 * While mounted with rows it clamps itself into the window, takes focus on the
 * first enabled row, supports arrows, Home, End and type-ahead, and gives focus
 * back to the previously focused element when it goes away unless something
 * else claimed focus in the meantime.
 */
export function definePptxContextMenu(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-context-menu')) {
		return;
	}
	class ContextMenu extends HTMLElement implements PptxUiContextMenuElement {
		private model: ContextMenuViewState = EMPTY_CONTEXT_MENU_STATE;
		private readonly view = createContextMenuView(this.ownerDocument);
		private opener: HTMLElement | null = null;
		private active = -1;
		private focused = false;
		private query = '';
		private queryTimer: ReturnType<typeof setTimeout> | undefined;
		private markers: string[] = [];
		private listening = false;
		private signature = '';

		constructor() {
			super();
			const root = this.attachShadow({ mode: 'open' });
			attachControlStyles(root, CONTEXT_MENU_STYLES);
			root.append(this.view.menu);
			this.view.menu.addEventListener('keydown', this.onKeyDown);
			this.view.menu.addEventListener('pointerover', this.onPointerOver);
			this.view.menu.addEventListener('contextmenu', (event) => event.preventDefault());
		}
		get state(): ContextMenuViewState {
			return this.model;
		}
		set state(value: ContextMenuViewState) {
			const signature = JSON.stringify(value);
			this.model = value;
			// Hosts re-send equal state on unrelated renders; rebuilding rows would drop hover.
			if (signature !== this.signature) {
				this.signature = signature;
				this.render();
			}
		}
		connectedCallback(): void {
			this.opener = this.deepActive();
			this.render();
		}
		disconnectedCallback(): void {
			this.stopListening();
			clearTimeout(this.queryTimer);
			this.focused = false;
			const opener = this.opener;
			this.opener = null;
			// Only restore when nothing else took focus (a command may open a dialog or editor).
			const active = this.ownerDocument.activeElement;
			if (opener?.isConnected && (!active || active === this.ownerDocument.body)) {
				opener.focus({ preventScroll: true });
			}
		}

		private deepActive(): HTMLElement | null {
			let node: Element | null = this.ownerDocument.activeElement;
			while (node?.shadowRoot?.activeElement) {
				node = node.shadowRoot.activeElement;
			}
			return node instanceof HTMLElement && node !== this.ownerDocument.body ? node : null;
		}

		private render(): void {
			const state = this.model;
			const items = state.items;
			this.hidden = items.length === 0;
			this.applyMarkers(state.markers ?? []);
			this.style.zIndex = String(state.zIndex ?? CONTEXT_MENU_EDITOR_LAYER);
			this.active = this.keepActive(items);
			this.view.render(state, this.active, (id) => this.request(id));
			if (items.length === 0) {
				this.stopListening();
				this.focused = false;
			}
			if (!this.isConnected || items.length === 0) {
				return;
			}
			this.place();
			this.listen();
			if (!this.focused && state.autoFocus !== false) {
				this.focused = true;
				this.focusIndex(nextEnabledIndex(items, -1, 1));
			} else if (this.focused && this.active >= 0) {
				this.view.buttons[this.active]?.focus({ preventScroll: true });
			}
		}

		private keepActive(items: ContextMenuViewState['items']): number {
			const same = items[this.active];
			return same && !same.disabled ? this.active : nextEnabledIndex(items, -1, 1);
		}

		private applyMarkers(next: readonly string[]): void {
			for (const name of this.markers) {
				this.removeAttribute(name);
			}
			this.markers = next.filter(isMarkerName);
			for (const name of this.markers) {
				this.setAttribute(name, 'true');
			}
		}

		private place(): void {
			const view = this.ownerDocument.defaultView;
			this.style.left = `${this.model.x}px`;
			this.style.top = `${this.model.y}px`;
			const box = this.getBoundingClientRect();
			const { left, top } = clampFlyoutPosition({
				x: this.model.x,
				y: this.model.y,
				width: box.width,
				height: box.height,
				viewportWidth: view?.innerWidth ?? box.right,
				viewportHeight: view?.innerHeight ?? box.bottom,
			});
			this.style.left = `${left}px`;
			this.style.top = `${top}px`;
		}

		private focusIndex(index: number): void {
			if (index < 0) {
				return;
			}
			this.active = index;
			this.view.buttons.forEach((button, at) => {
				button.tabIndex = at === index ? 0 : -1;
			});
			this.view.buttons[index]?.focus({ preventScroll: true });
		}

		private request(id: string): void {
			this.dispatchEvent(
				new CustomEvent<ContextMenuRequestDetail>('menu-request', {
					detail: { id },
					bubbles: true,
					composed: true,
				}),
			);
		}

		private dismiss(reason: ContextMenuCloseReason): void {
			this.dispatchEvent(
				new CustomEvent<ContextMenuCloseDetail>('menu-close', {
					detail: { reason },
					bubbles: true,
					composed: true,
				}),
			);
		}

		private readonly onPointerOver = (event: Event): void => {
			const button = (event.target as Element | null)?.closest('button');
			const index = button ? this.view.buttons.indexOf(button) : -1;
			if (index >= 0 && !button?.disabled && index !== this.active) {
				this.focusIndex(index);
			}
		};

		private readonly onKeyDown = (event: KeyboardEvent): void => {
			const items = this.model.items;
			let target = -2;
			if (event.key === 'ArrowDown') {
				target = nextEnabledIndex(items, this.active, 1);
			} else if (event.key === 'ArrowUp') {
				target = nextEnabledIndex(items, this.active, -1);
			} else if (event.key === 'Home') {
				target = nextEnabledIndex(items, -1, 1);
			} else if (event.key === 'End') {
				target = nextEnabledIndex(items, items.length, -1);
			} else if (
				event.key.length === 1 &&
				event.key !== ' ' &&
				!event.ctrlKey &&
				!event.metaKey &&
				!event.altKey
			) {
				this.query += event.key;
				clearTimeout(this.queryTimer);
				this.queryTimer = setTimeout(() => (this.query = ''), TYPE_AHEAD_MS);
				target = typeAheadIndex(items, this.active, this.query);
			}
			if (target === -2) {
				return;
			}
			event.preventDefault();
			this.focusIndex(target);
		};

		private readonly onDocumentKey = (event: KeyboardEvent): void => {
			const stack = openMenus.get(this.ownerDocument);
			if (stack?.at(-1) !== this) {
				return;
			}
			if (event.key === 'Escape') {
				// The menu consumes Escape so a slide show behind it does not also exit.
				event.preventDefault();
				event.stopPropagation();
				this.dismiss('escape');
			} else if (event.key === 'Tab') {
				this.dismiss('tab');
			}
		};

		private readonly onDocumentPointer = (event: Event): void => {
			if (!event.composedPath().includes(this)) {
				this.dismiss('outside');
			}
		};

		private listen(): void {
			if (this.listening) {
				return;
			}
			this.listening = true;
			const doc = this.ownerDocument;
			openMenus.set(doc, [...(openMenus.get(doc) ?? []), this]);
			doc.addEventListener('keydown', this.onDocumentKey, true);
			doc.addEventListener('pointerdown', this.onDocumentPointer, true);
		}

		private stopListening(): void {
			if (!this.listening) {
				return;
			}
			this.listening = false;
			const doc = this.ownerDocument;
			openMenus.set(
				doc,
				(openMenus.get(doc) ?? []).filter((menu) => menu !== this),
			);
			doc.removeEventListener('keydown', this.onDocumentKey, true);
			doc.removeEventListener('pointerdown', this.onDocumentPointer, true);
		}
	}
	registry.define('pptx-ui-context-menu', ContextMenu);
}
