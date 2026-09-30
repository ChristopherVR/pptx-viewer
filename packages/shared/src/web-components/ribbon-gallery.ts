import { galleryHasItems } from '../render';
import type { RibbonGalleryDescriptor } from '../render';
import { attachRibbonGalleryStyles } from './ribbon-gallery-styles';
import { createRibbonGalleryView } from './ribbon-gallery-view';
import type { GalleryTranslate } from './ribbon-gallery-view';

export type RibbonGalleryPickEvent = CustomEvent<{ gallery: string; itemId: string }>;
export interface PptxUiRibbonGalleryElement extends HTMLElement {
	readonly trigger: HTMLButtonElement;
	readonly popup: HTMLElement;
	descriptor: RibbonGalleryDescriptor | undefined;
	translateLabel: GalleryTranslate;
	disabled: boolean;
	open: boolean;
	close(): void;
}
declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-ribbon-gallery': PptxUiRibbonGalleryElement;
	}
}

/** Shared light-DOM view preserves the established gallery selector/customization ABI. */
export function definePptxRibbonGallery(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-gallery')) {
		return;
	}
	class RibbonGallery extends HTMLElement implements PptxUiRibbonGalleryElement {
		static observedAttributes = ['mode', 'chevron-only', 'icon', 'data-ribbon-control'];
		private value: RibbonGalleryDescriptor | undefined;
		private t: GalleryTranslate = (key) => key;
		private locked = false;
		private opened = false;
		private readonly view;
		constructor() {
			super();
			this.view = createRibbonGalleryView(
				this.ownerDocument,
				(itemId) => this.pick(itemId),
				() => {
					this.open = !this.open;
				},
			);
			this.view.root.addEventListener('keydown', (event) => {
				if (event.key === 'Escape' && this.open) {
					event.stopPropagation();
					event.preventDefault();
					this.close();
					this.view.trigger.focus();
				}
				if (event.key === 'ArrowDown' && event.target === this.view.trigger) {
					event.stopPropagation();
					event.preventDefault();
					this.open = true;
					this.view.popup.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
				}
				if (event.key === 'Enter' || event.key === ' ') {
					event.stopPropagation();
				}
			});
		}
		get descriptor() {
			return this.value;
		}
		set descriptor(value: RibbonGalleryDescriptor | undefined) {
			this.value = value;
			this.paint();
		}
		get trigger() {
			return this.view.trigger;
		}
		get popup() {
			return this.view.popup;
		}

		get translateLabel() {
			return this.t;
		}
		set translateLabel(value: GalleryTranslate) {
			this.t = value;
			this.paint();
		}
		get disabled() {
			return this.locked;
		}
		set disabled(value: boolean) {
			this.locked = Boolean(value);
			this.paint();
		}
		get open() {
			return this.opened;
		}
		set open(value: boolean) {
			const next = Boolean(value) && !this.unavailable();
			if (next === this.opened) {
				return;
			}
			this.opened = next;
			this.view.setOpen(next);
			this.paint();
			this.view.trigger.setAttribute('aria-expanded', String(next));
			this.cleanup();
			if (next && this.isConnected) {
				this.ownerDocument.addEventListener('pointerdown', this.outside, true);
				this.ownerDocument.addEventListener('keydown', this.escape);
				this.ownerDocument.defaultView?.addEventListener('resize', this.position);
				this.ownerDocument.addEventListener('scroll', this.position, true);
				this.position();
			}
		}
		close(): void {
			this.open = false;
		}
		connectedCallback(): void {
			attachRibbonGalleryStyles(this.ownerDocument);
			this.append(this.view.root);
			this.paint();
		}
		disconnectedCallback(): void {
			this.close();
			this.cleanup();
		}
		attributeChangedCallback(): void {
			this.paint();
		}
		private unavailable() {
			return this.locked || !this.value || this.value.disabled || !galleryHasItems(this.value);
		}
		private paint(): void {
			if (!this.value) {
				this.close();
				this.view.clear();
				this.view.trigger.disabled = true;
				return;
			}
			const hadFocus = this.contains(this.ownerDocument.activeElement);
			if (this.view.root.parentElement !== this) {
				this.append(this.view.root);
			}
			const focusedId = this.ownerDocument.activeElement?.getAttribute('data-gallery-item');
			const focusInPopup = this.view.popup.contains(this.ownerDocument.activeElement);
			this.view.paint(
				this.value,
				this.t,
				this.unavailable(),
				this.getAttribute('mode') === 'inline' && !this.hasAttribute('chevron-only'),
				this.hasAttribute('chevron-only'),
				this.getAttribute('icon') ?? 'palette',
				this.open,
				this.getAttribute('data-ribbon-control') ?? undefined,
			);
			this.view.trigger.setAttribute('aria-expanded', String(this.open));
			if (this.unavailable()) {
				this.close();
			}
			if (this.open) {
				this.position();
			}
			if (focusedId && hadFocus) {
				(focusInPopup ? this.view.popup : this)
					.querySelector<HTMLButtonElement>(`[data-gallery-item="${CSS.escape(focusedId)}"]`)
					?.focus();
			}
		}
		private pick(itemId: string): void {
			if (
				this.unavailable() ||
				!this.value?.sections.some((section) => section.items.some((item) => item.id === itemId))
			) {
				return;
			}
			this.close();
			this.view.trigger.focus();
			this.dispatchEvent(
				new CustomEvent('gallery-pick', {
					detail: { gallery: this.value.id, itemId },
					bubbles: true,
					composed: true,
				}),
			);
		}
		private readonly outside = (event: Event): void => {
			if (!event.composedPath().includes(this)) {
				this.close();
			}
		};
		private readonly escape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				event.stopPropagation();
				this.close();
				this.view.trigger.focus();
			}
		};
		private readonly position = (): void => {
			const window = this.ownerDocument.defaultView;
			if (!window) {
				return;
			}
			const anchor = this.view.trigger.getBoundingClientRect();
			const width = this.view.popup.getBoundingClientRect().width;
			this.view.popup.style.left = `${Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))}px`;
			this.view.popup.style.top = `${Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - this.view.popup.getBoundingClientRect().height - 8))}px`;
		};
		private cleanup(): void {
			this.ownerDocument.removeEventListener('pointerdown', this.outside, true);
			this.ownerDocument.removeEventListener('keydown', this.escape);
			this.ownerDocument.defaultView?.removeEventListener('resize', this.position);
			this.ownerDocument.removeEventListener('scroll', this.position, true);
		}
	}
	registry.define('pptx-ui-ribbon-gallery', RibbonGallery);
}
