import {
	activeGalleryThemePreset,
	DESIGN_RIBBON_COMMANDS,
	DESIGN_RIBBON_GROUPS,
	FIXED_TAB_GALLERIES,
	GALLERY_THEME_PRESETS,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { AnchoredPopupHandle } from '../../anchored-popup';
import { attachAnchoredPopup } from '../../anchored-popup';
import type { ButtonHandle } from '../../controls';
import { makeButton } from '../../controls';
import { onDocumentPointerDown } from '../../outside-pointer';
import type { RibbonGalleryHub } from '../gallery/gallery-hub';
import { createRibbonGallery } from '../gallery/ribbon-gallery';
import type { RibbonDesignHandlers } from '../ribbon-types';
import { createSharedRibbonCommand } from '../shared-command';
import type { SharedRibbonCommandHandle } from '../shared-command';
import { createThemeEditorLauncher } from './theme-editor-launcher';

export interface DesignTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	/** Open or close the Browse Themes gallery (title-bar command search). */
	toggleThemes(): void;
}

/** A ribbon button that toggles a swatch gallery docked underneath it. */
interface GalleryControl {
	el: HTMLElement;
	button: SharedRibbonCommandHandle;
	gallery: HTMLElement;
	close(): void;
	toggle(): void;
}

function createGalleryControl(
	doc: Document,
	button: SharedRibbonCommandHandle,
	title: string,
): GalleryControl {
	const el = createEl(doc, 'div', 'pptxv-theme-gallery-host');
	const gallery = createEl(doc, 'div', 'pptxv-theme-gallery');
	gallery.hidden = true;
	button.btn.title = title;
	button.btn.setAttribute('aria-haspopup', 'true');
	button.setExpanded(false);
	let isOpen = false;
	// Pinned with `position: fixed` while open, so the popover escapes the
	// ribbon row's overflow clip (issue #183) like every other ribbon menu.
	let anchored: AnchoredPopupHandle | null = null;
	const setOpen = (open: boolean): void => {
		isOpen = open;
		gallery.hidden = !open;
		button.setExpanded(open);
		button.setActive(open);
		anchored?.destroy();
		anchored = open ? attachAnchoredPopup(gallery, button.btn) : null;
	};
	button.el.addEventListener('command-request', (event) => {
		event.stopPropagation();
		setOpen(!isOpen);
	});
	onDocumentPointerDown(doc, el, (event) => {
		if (isOpen && !el.contains(event.target as Node)) {
			setOpen(false);
		}
	});
	el.append(button.el, gallery);
	return { el, button, gallery, close: () => setOpen(false), toggle: () => setOpen(!isOpen) };
}

/** Prepend the colour chip React's theme gallery shows beside each preset name. */
function withPreview(doc: Document, button: ButtonHandle, background: string): HTMLButtonElement {
	const preview = createEl(doc, 'span', 'pptxv-theme-swatch-preview');
	preview.style.background = background;
	button.btn.prepend(preview);
	return button.btn;
}

/**
 * The Design ribbon tab: Browse Themes, Edit Theme, Slide Size and Format
 * Background, the four commands React's `DesignSection` offers, plus the
 * Variants Colors / Fonts galleries.
 *
 * Both theme commands act on the presentation theme. Browse Themes opens
 * the shared preset gallery. Edit Theme opens a panel docked to the right of
 * the editor body below the ribbon, matching React's ThemeEditorPanel.
 *
 * `onOpenSlideSize` reveals the inspector's SLIDE SIZE card (see `ribbon.ts`),
 * the binding's only slide-size control. It used to open the Document
 * Properties dialog, which has no slide-size field at all.
 */
export function createDesignTab(
	doc: Document,
	t: Translator,
	handlers: RibbonDesignHandlers,
	onToggleFormatBackground: () => void,
	onOpenSlideSize: () => void,
	galleryHub?: RibbonGalleryHub,
): DesignTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	const command = (id: string, onCommand: () => void) => {
		const descriptor = DESIGN_RIBBON_COMMANDS.find((item) => item.id === id)!;
		return createSharedRibbonCommand(doc, {
			id: descriptor.id,
			label: t(descriptor.labelKey),
			title: t(descriptor.titleKey),
			icon: descriptor.icon,
			onCommand,
		});
	};
	const group = (id: string) => {
		const descriptor = DESIGN_RIBBON_GROUPS.find((item) => item.id === id)!;
		const node = doc.createElement('pptx-ui-ribbon-group');
		node.setAttribute('data-ribbon-group', descriptor.id);
		node.setAttribute('label', t(descriptor.labelKey));
		return node;
	};
	const browse = createGalleryControl(
		doc,
		command('design.themes.browseThemes', () => {}),
		t('pptx.ribbon.browseThemesTitle'),
	);
	browse.gallery.setAttribute('role', 'menu');
	browse.gallery.setAttribute('aria-label', t('pptx.themes.gallery.ariaLabel'));
	const deckThemeButtons = GALLERY_THEME_PRESETS.map((preset) => {
		const button = makeButton(doc, {
			label: preset.name,
			text: preset.name,
			onClick: () => {
				handlers.applyPresentationTheme(preset.id);
				browse.close();
			},
		});
		button.btn.setAttribute('role', 'menuitemradio');
		button.btn.setAttribute('aria-checked', 'false');
		button.btn.dataset.themePreset = preset.id;
		browse.gallery.appendChild(
			withPreview(
				doc,
				button,
				`linear-gradient(135deg, ${preset.colorScheme.accent1}, ${preset.colorScheme.accent2})`,
			),
		);
		return button;
	});

	const editTheme = createThemeEditorLauncher(doc, t, handlers);

	const slideSize = command('design.customize.slideSize', onOpenSlideSize);
	const formatBackground = command('design.customize.formatBackground', onToggleFormatBackground);
	const themes = group('design.themes');
	themes.append(browse.el, editTheme.el);
	el.append(themes);
	// Design > Variants: the deck theme's Colors / Fonts libraries, straight
	// from the shared gallery placements.
	if (galleryHub) {
		const variants = group('design.variants');
		for (const placement of FIXED_TAB_GALLERIES) {
			if (placement.control.startsWith('design.variants.')) {
				variants.appendChild(createRibbonGallery(doc, t, placement, galleryHub).el);
			}
		}
		el.appendChild(variants);
		// Keep the Browse Themes check mark and the Edit Theme editor on the
		// deck's current theme (the hub pushes the theme with every selection sync).
		galleryHub.register({
			refresh(ctx, editable) {
				const activeId = activeGalleryThemePreset(ctx.theme)?.id;
				for (const button of deckThemeButtons) {
					button.btn.setAttribute(
						'aria-checked',
						String(button.btn.dataset.themePreset === activeId),
					);
				}
				editTheme.update({
					editable,
					colorScheme: ctx.theme?.colorScheme,
					fontScheme: ctx.theme?.fontScheme,
					themeName: ctx.theme?.name,
				});
			},
			close() {},
		});
	}
	const customize = group('design.customize');
	customize.append(slideSize.el, formatBackground.el);
	el.append(customize);

	return {
		el,
		toggleThemes: () => browse.toggle(),
		setEditable(editable) {
			browse.button.setDisabled(!editable);
			editTheme.button.setDisabled(!editable);
			formatBackground.setDisabled(!editable);
			for (const button of deckThemeButtons) {
				button.setDisabled(!editable);
			}
			if (!editable) {
				browse.close();
				editTheme.close();
			}
		},
	};
}
