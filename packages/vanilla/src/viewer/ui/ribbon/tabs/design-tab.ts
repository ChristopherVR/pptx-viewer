import {
	activeGalleryThemePreset,
	FIXED_TAB_GALLERIES,
	GALLERY_THEME_PRESETS,
} from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { AnchoredPopupHandle } from '../../anchored-popup';
import { attachAnchoredPopup } from '../../anchored-popup';
import type { ButtonHandle } from '../../controls';
import { makeButton } from '../../controls';
import { createThemeEditorCard } from '../../inspector/theme-editor-card';
import type { ThemeEditorCard, ThemeEditorCardState } from '../../inspector/theme-editor-card';
import { createRibbonGroupShell } from '../gallery/contextual-tabs';
import type { RibbonGalleryHub } from '../gallery/gallery-hub';
import { createRibbonGallery } from '../gallery/ribbon-gallery';
import { tagRibbonControl, wrapRibbonGroup } from '../ribbon-tagging';
import type { RibbonDesignHandlers } from '../ribbon-types';

export interface DesignTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
}

/** A ribbon button that toggles a swatch gallery docked underneath it. */
interface GalleryControl {
	el: HTMLElement;
	button: ButtonHandle;
	gallery: HTMLElement;
	close(): void;
}

function createGalleryControl(doc: Document, button: ButtonHandle, title: string): GalleryControl {
	const el = createEl(doc, 'div', 'pptxv-theme-gallery-host');
	const gallery = createEl(doc, 'div', 'pptxv-theme-gallery');
	gallery.hidden = true;
	button.btn.title = title;
	button.btn.setAttribute('aria-haspopup', 'true');
	button.btn.setAttribute('aria-expanded', 'false');
	let isOpen = false;
	// Pinned with `position: fixed` while open, so the popover escapes the
	// ribbon row's overflow clip (issue #183) like every other ribbon menu.
	let anchored: AnchoredPopupHandle | null = null;
	const setOpen = (open: boolean): void => {
		isOpen = open;
		gallery.hidden = !open;
		button.btn.setAttribute('aria-expanded', String(open));
		anchored?.destroy();
		anchored = open ? attachAnchoredPopup(gallery, button.btn) : null;
	};
	button.btn.addEventListener('click', (event) => {
		event.stopPropagation();
		setOpen(!isOpen);
	});
	doc.addEventListener('pointerdown', (event) => {
		if (isOpen && !el.contains(event.target as Node)) {
			setOpen(false);
		}
	});
	el.append(button.btn, gallery);
	return { el, button, gallery, close: () => setOpen(false) };
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
 * Both theme commands act on the PRESENTATION theme, as in React, Vue and
 * Angular. "Browse Themes" drops down the shared `GALLERY_THEME_PRESETS` (the
 * active one checked via `activeGalleryThemePreset`) and a pick re-themes the
 * deck; "Edit Theme" drops down the deck theme editor, the same THEME EDITOR
 * card the inspector hosts. Both hang off their buttons as popovers, which is
 * what keeps a dozen theme names out of the tab's flat control list. The
 * viewer chrome's own theme is `PptxViewer.setTheme` / Options, not Design.
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

	const browse = createGalleryControl(
		doc,
		makeButton(doc, {
			label: t('pptx.ribbon.browseThemes'),
			icon: 'sparkles',
			textLabel: t('pptx.ribbon.browseThemes'),
			onClick: () => {},
		}),
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

	const editTheme = createGalleryControl(
		doc,
		makeButton(doc, {
			label: t('pptx.ribbon.editTheme'),
			icon: 'wrench',
			textLabel: t('pptx.ribbon.editTheme'),
			onClick: () => {},
		}),
		t('pptx.ribbon.editThemeTitle'),
	);
	editTheme.gallery.classList.add('pptxv-deck-theme-editor');
	editTheme.gallery.dataset.deckThemeEditor = '';
	// The editor card is a sizeable DOM tree (12 colour slots, two font
	// lists), so it is built on first open rather than with every ribbon.
	let themeEditor: ThemeEditorCard | null = null;
	let themeState: ThemeEditorCardState = {
		editable: false,
		colorScheme: undefined,
		fontScheme: undefined,
		themeName: undefined,
	};
	editTheme.button.btn.addEventListener('click', () => {
		if (!themeEditor) {
			themeEditor = createThemeEditorCard(doc, t, {
				applyThemeEdit: (payload) => {
					handlers.applyThemeEdit(payload);
					editTheme.close();
				},
			});
			themeEditor.update(themeState);
			editTheme.gallery.appendChild(themeEditor.el);
		}
	});

	const slideSize = makeButton(doc, {
		label: t('pptx.ribbon.slideSize'),
		icon: 'monitor',
		textLabel: t('pptx.ribbon.slideSize'),
		onClick: onOpenSlideSize,
	});
	slideSize.btn.title = t('pptx.ribbon.slideSizeTitle');

	const formatBackground = makeButton(doc, {
		label: t('pptx.ribbon.formatBackground'),
		icon: 'square',
		textLabel: t('pptx.ribbon.formatBackground'),
		onClick: onToggleFormatBackground,
	});
	formatBackground.btn.title = t('pptx.ribbon.formatBackgroundTitle');

	tagRibbonControl(browse.el, 'design.themes.browseThemes');
	tagRibbonControl(editTheme.el, 'design.themes.editTheme');
	tagRibbonControl(slideSize.btn, 'design.customize.slideSize');
	tagRibbonControl(formatBackground.btn, 'design.customize.formatBackground');
	el.appendChild(wrapRibbonGroup(doc, 'design.themes', browse.el, editTheme.el));
	// Design > Variants: the deck theme's Colors / Fonts libraries, straight
	// from the shared gallery placements.
	if (galleryHub) {
		const variants = createRibbonGroupShell(doc, 'design.variants', t('pptx.ribbon.groupVariants'));
		for (const placement of FIXED_TAB_GALLERIES) {
			if (placement.control.startsWith('design.variants.')) {
				variants.row.appendChild(createRibbonGallery(doc, t, placement, galleryHub).el);
			}
		}
		el.appendChild(variants.el);
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
				themeState = {
					editable,
					colorScheme: ctx.theme?.colorScheme,
					fontScheme: ctx.theme?.fontScheme,
					themeName: ctx.theme?.name,
				};
				themeEditor?.update(themeState);
			},
			close() {},
		});
	}
	el.appendChild(wrapRibbonGroup(doc, 'design.customize', slideSize.btn, formatBackground.btn));

	return {
		el,
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
