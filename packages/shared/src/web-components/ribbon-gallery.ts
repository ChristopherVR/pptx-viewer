import { defineGallery } from 'ooxml-ui/controls';
import type { OfficeGalleryItem, OfficeGalleryState } from 'ooxml-ui/controls';
import { getIcon, paintIcon, registerIcon } from 'ooxml-ui/icons';

import {
	createRibbonControlIcon,
	galleryItemLabel,
	inlineGalleryItems,
	RIBBON_CONTROL_ICONS,
} from '../render';
import type { RibbonGalleryDescriptor, RibbonGalleryItem } from '../render';
import { attachControlStyles } from './control-styles';
import { bridgeCss } from './office-token-bridge';
import { attachRibbonGalleryStyles } from './ribbon-gallery-styles';
import { RIBBON_ICON_PATHS } from './ribbon-icons';

export type GalleryTranslate = (
	key: string,
	params?: Readonly<Record<string, string | number>>,
) => string;
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

/** A translated caption, or the English fallback when the dictionary misses the key. */
function caption(t: GalleryTranslate, key: string, fallback: string): string {
	const translated = t(key);
	return translated && translated !== key ? translated : fallback;
}

/** A pptx descriptor (catalogue keys, raw command path) resolved into the shared gallery state. */
export function officeGalleryState(
	descriptor: RibbonGalleryDescriptor,
	t: GalleryTranslate,
): OfficeGalleryState {
	const label = caption(t, descriptor.labelKey, descriptor.label);
	const more = t('pptx.gallery.more', { name: label });
	const item = (entry: RibbonGalleryItem): OfficeGalleryItem => ({
		id: entry.id,
		label: galleryItemLabel(entry, t),
		applied: entry.applied,
		preview: entry.previewSvg,
	});
	const command = descriptor.command;
	if (command) {
		registerIcon(`pptx:gallery-${descriptor.id}`, command.iconPath);
	}
	return {
		id: descriptor.id,
		label,
		moreLabel: more === 'pptx.gallery.more' ? `More ${label}` : more,
		disabled: descriptor.disabled,
		command: command
			? {
					icon: `pptx:gallery-${descriptor.id}`,
					large: command.large,
					hint: command.hintKey ? caption(t, command.hintKey, command.hint ?? label) : label,
				}
			: undefined,
		sections: descriptor.sections.map((section) => ({
			title: section.titleKey ? caption(t, section.titleKey, section.title ?? '') : section.title,
			columns: section.columns,
			tileWidth: section.tileWidth,
			tileHeight: section.tileHeight,
			items: section.items.map(item),
		})),
		inline: inlineGalleryItems(descriptor).map(item),
	};
}

interface SharedGallery extends HTMLElement {
	readonly trigger: HTMLButtonElement;
	triggerIcon(): Element | null;
	attributeChangedCallback(): void;
	connectedCallback(): void;
}

/**
 * `pptx-ui-ribbon-gallery`: the shared `office-ui-gallery` under its published pptx contract.
 * Hosts set `descriptor` (and `translateLabel`); `gallery-pick` `{ gallery, itemId }` and the
 * `data-ribbon-gallery`, `data-ribbon-gallery-popup`, `data-gallery-item` and
 * `data-pptx-compact` hooks stay. The trigger keeps the pptx ribbon artwork.
 */
export function definePptxRibbonGallery(registry: CustomElementRegistry): void {
	if (registry.get('pptx-ui-ribbon-gallery')) {
		return;
	}
	defineGallery(registry);
	const Base = registry.get('office-ui-gallery') as unknown as (new () => SharedGallery) & {
		observedAttributes: string[];
	};
	const setShared = Object.getOwnPropertyDescriptor(Base.prototype, 'state')!.set!;
	class PptxRibbonGallery extends Base {
		static pickEvent = 'gallery-pick';
		static triggerAttribute = 'data-ribbon-gallery';
		static popupAttribute = 'data-ribbon-gallery-popup';
		static itemAttribute = 'data-gallery-item';
		static compactAttribute = 'data-pptx-compact';
		static override get observedAttributes(): string[] {
			return [...Base.observedAttributes, 'data-ribbon-control'];
		}
		#descriptor: RibbonGalleryDescriptor | undefined;
		#t: GalleryTranslate = (key) => key;
		constructor() {
			super();
			if (this.shadowRoot) {
				attachControlStyles(this.shadowRoot, bridgeCss('pptx-ui-ribbon-gallery'));
			}
		}
		get descriptor(): RibbonGalleryDescriptor | undefined {
			return this.#descriptor;
		}
		set descriptor(value: RibbonGalleryDescriptor | undefined) {
			this.#descriptor = value;
			this.#sync();
		}
		get translateLabel(): GalleryTranslate {
			return this.#t;
		}
		set translateLabel(value: GalleryTranslate) {
			this.#t = value;
			this.#sync();
		}
		override connectedCallback(): void {
			attachRibbonGalleryStyles(this.ownerDocument);
			super.connectedCallback();
		}
		/** The ribbon control's own artwork when it has one, else the named pptx glyph. */
		override triggerIcon(): Element | null {
			const doc = this.ownerDocument;
			const controlId = this.getAttribute('data-ribbon-control');
			if (!this.#descriptor?.command && controlId && RIBBON_CONTROL_ICONS[controlId]) {
				const svg = createRibbonControlIcon(doc, controlId);
				svg.setAttribute('aria-hidden', 'true');
				return svg;
			}
			if (this.#descriptor?.command) {
				return super.triggerIcon();
			}
			const name = this.getAttribute('icon') ?? 'palette';
			const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('aria-hidden', 'true');
			const icon = `pptx:${RIBBON_ICON_PATHS[name] ? name : 'palette'}`;
			if (!getIcon(icon)) {
				registerIcon(icon, RIBBON_ICON_PATHS[name] ?? RIBBON_ICON_PATHS.palette ?? '');
			}
			paintIcon(svg, icon);
			return svg;
		}
		#sync(): void {
			setShared.call(
				this,
				this.#descriptor ? officeGalleryState(this.#descriptor, this.#t) : undefined,
			);
			// The shared element mounts its view only once connected; pptx hosts (vanilla builds
			// the whole ribbon detached) populate and query galleries before insertion.
			const view = this.trigger.parentElement;
			if (this.#descriptor && !this.isConnected && view && view.parentElement !== this) {
				this.append(view);
			}
		}
	}
	registry.define(
		'pptx-ui-ribbon-gallery',
		PptxRibbonGallery as unknown as CustomElementConstructor,
	);
}
