import type {
	RibbonGalleryDescriptor,
	RibbonGalleryId,
	RibbonGalleryItem,
	RibbonGalleryPlacement,
} from 'pptx-viewer-shared';
import {
	armEditorKeyboard,
	buildRibbonGallery,
	galleryHasItems,
	inlineGalleryItems,
	RIBBON_CONTROL_ATTR,
	RIBBON_GALLERY_ATTR,
	RIBBON_GALLERY_POPUP_ATTR,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { AnchoredPopupHandle } from '../../anchored-popup';
import { attachAnchoredPopup } from '../../anchored-popup';
import type { IconName } from '../../icons';
import { createIcon } from '../../icons';
import type { RibbonGalleryHub, RibbonGalleryView } from './gallery-hub';
import { createGalleryTile, renderGalleryPopup, translateOr } from './gallery-tiles';

const GALLERY_ICONS: Record<RibbonGalleryId, IconName> = {
	shapeStyles: 'paintbrush',
	shapeEffects: 'sparkles',
	wordArtStyles: 'font-color',
	pictureStyles: 'image',
	bullets: 'bullet-list',
	numbering: 'numbered-list',
	tableStyles: 'table',
	chartStyles: 'chart',
	chartColors: 'paintbrush',
	chartQuickLayout: 'layout',
	smartArtStyles: 'smart-art',
	smartArtColors: 'paintbrush',
	themeColors: 'paintbrush',
	themeFonts: 'font-color',
};

export interface RibbonGalleryOptions {
	/**
	 * A chevron-only trigger (no icon, no caption), for the Bullets / Numbering
	 * library dropdowns that sit right after their toggle buttons. The wrapper
	 * then carries no `data-ribbon-control`, because the caller's toggle+chevron
	 * wrapper does.
	 */
	chevronOnly?: boolean;
}

export interface RibbonGalleryControl extends RibbonGalleryView {
	el: HTMLElement;
	/** The dropdown button, or the inline gallery's "more" button. */
	trigger: HTMLButtonElement;
	popup: HTMLElement;
	isOpen(): boolean;
}

/**
 * A ribbon style gallery (Shape Styles, Theme Colors, ...), rendered from the
 * shared descriptor. `dropdown` mode is one trigger button that opens the
 * panel; `inline` mode shows the first tiles in the ribbon itself with a
 * "more" button for the panel. The panel reuses the ribbon's fixed-position
 * anchoring (so the scrolling ribbon row cannot clip it), closes on an outside
 * pointerdown or Escape, and a tile pick goes through the hub, which asks the
 * shared registry what to write.
 */
export function createRibbonGallery(
	doc: Document,
	t: Translator,
	placement: RibbonGalleryPlacement,
	hub: RibbonGalleryHub,
	options: RibbonGalleryOptions = {},
): RibbonGalleryControl {
	const inline = placement.mode === 'inline';
	const el = createEl(doc, 'div', `pptxv-gallery${inline ? ' pptxv-gallery-inline' : ''}`);
	if (!options.chevronOnly) {
		el.setAttribute(RIBBON_CONTROL_ATTR, placement.control);
	}
	const strip = inline ? createEl(doc, 'div', 'pptxv-gallery-strip') : null;
	const trigger = createEl(
		doc,
		'button',
		inline
			? 'pptxv-gallery-more'
			: `pptxv-dropdown-trigger pptxv-gallery-trigger${options.chevronOnly ? ' pptxv-gallery-chevron' : ''}`,
	);
	trigger.type = 'button';
	trigger.setAttribute(RIBBON_GALLERY_ATTR, placement.gallery);
	trigger.setAttribute('aria-haspopup', 'true');
	trigger.setAttribute('aria-expanded', 'false');
	const caption = createEl(doc, 'span', 'pptxv-dropdown-text');
	if (!inline && !options.chevronOnly) {
		trigger.append(createIcon(doc, GALLERY_ICONS[placement.gallery]), caption);
	}
	trigger.appendChild(createIcon(doc, 'chevron-down'));

	const popup = createEl(doc, 'div', 'pptxv-gallery-popup');
	popup.setAttribute(RIBBON_GALLERY_POPUP_ATTR, placement.gallery);
	popup.setAttribute('role', 'dialog');
	popup.hidden = true;
	if (strip) {
		el.appendChild(strip);
	}
	// The panel is only in the DOM while open (see `setOpen`), like the other
	// bindings' conditionally rendered popups.
	el.append(trigger);

	let descriptor: RibbonGalleryDescriptor | null = null;
	let disabled = true;
	let anchor: AnchoredPopupHandle | null = null;
	// The panel's tiles (dozens of preview SVGs per gallery) are built when it
	// opens, not on every selection sync, and only rebuilt when stale.
	let popupStale = true;

	const onOutsidePointer = (event: PointerEvent): void => {
		if (!el.contains(event.target as Node)) {
			setOpen(false);
		}
	};

	function renderPopupIfStale(): void {
		if (popupStale && descriptor) {
			renderGalleryPopup(doc, t, popup, descriptor, disabled, onPick);
			popupStale = false;
		}
	}

	function setOpen(open: boolean): void {
		const next = open && !disabled;
		if (next) {
			renderPopupIfStale();
		}
		popup.hidden = !next;
		if (next) {
			el.append(popup);
		} else {
			popup.remove();
		}
		trigger.setAttribute('aria-expanded', String(next));
		trigger.classList.toggle('is-active', next);
		anchor?.destroy();
		anchor = next ? attachAnchoredPopup(popup, trigger) : null;
		// Listen for the outside press only while open, so a closed (or
		// discarded, after a ribbon rebuild) gallery holds no document listener.
		doc.removeEventListener('pointerdown', onOutsidePointer);
		if (next) {
			doc.addEventListener('pointerdown', onOutsidePointer);
		}
	}

	const onPick = (item: RibbonGalleryItem): void => {
		setOpen(false);
		hub.pick(placement.gallery, item.id);
		// The picked tile may be gone after the rebuild, dropping focus to <body>
		// where the editor keymap never hears Ctrl+Z; hand it back to the viewer.
		armEditorKeyboard(el.closest<HTMLElement>('.pptxv'));
	};

	trigger.addEventListener('mousedown', (event) => event.preventDefault());
	trigger.addEventListener('click', (event) => {
		event.stopPropagation();
		setOpen(popup.hidden === true);
	});
	el.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && popup.hidden !== true) {
			event.stopPropagation();
			setOpen(false);
			trigger.focus();
		}
	});

	const control: RibbonGalleryControl = {
		el,
		trigger,
		popup,
		isOpen: () => popup.hidden !== true,
		close: () => setOpen(false),
		refresh(ctx, editable) {
			descriptor = buildRibbonGallery(placement.gallery, ctx);
			disabled = !editable || descriptor.disabled || !galleryHasItems(descriptor);
			const title = translateOr(t, descriptor.labelKey, descriptor.label);
			caption.textContent = title;
			const triggerLabel = inline ? t('pptx.gallery.more', { name: title }) : title;
			trigger.title = triggerLabel;
			trigger.setAttribute('aria-label', triggerLabel);
			trigger.disabled = disabled;
			el.classList.toggle('is-disabled', disabled);
			strip?.replaceChildren(
				...inlineGalleryItems(descriptor).map((item) =>
					createGalleryTile(doc, t, item, disabled, onPick),
				),
			);
			popupStale = true;
			if (popup.hidden !== true) {
				renderPopupIfStale();
			}
			if (disabled) {
				setOpen(false);
			} else {
				anchor?.update();
			}
		},
	};
	hub.register(control);
	return control;
}
