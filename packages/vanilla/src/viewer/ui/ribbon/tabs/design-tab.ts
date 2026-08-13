import { THEME_PRESETS } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';
import { vermilionDarkTheme, vermilionLightTheme } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { ButtonHandle } from '../../controls';
import { makeButton } from '../../controls';
import type { RibbonDesignHandlers } from '../ribbon-types';

/** One chrome-theme swatch: a label plus the `ViewerTheme` it applies (`undefined` resets). */
interface ThemeSwatch {
	labelKey: string;
	theme: ViewerTheme | undefined;
}

const CHROME_THEMES: readonly ThemeSwatch[] = [
	{ labelKey: 'pptx.ribbon.theme.default', theme: undefined },
	{ labelKey: 'pptx.ribbon.theme.light', theme: vermilionLightTheme },
	{ labelKey: 'pptx.ribbon.theme.dark', theme: vermilionDarkTheme },
];

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
	const setOpen = (open: boolean): void => {
		isOpen = open;
		gallery.hidden = !open;
		button.btn.setAttribute('aria-expanded', String(open));
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
 * Background, the four commands React's `DesignSection` offers.
 *
 * The two theme galleries hang off their buttons as popovers rather than
 * sitting open on the ribbon, which is both what React does (its gallery is a
 * toggled panel) and what keeps a dozen theme names out of the tab's flat
 * control list. "Browse Themes" applies a PowerPoint deck theme
 * (`THEME_PRESETS`); "Edit Theme" swaps the *viewer chrome* palette, which is
 * the only theme-editing affordance this binding has (React's own tooltip
 * admits its theme editor is not ported either).
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
	const deckThemeButtons = THEME_PRESETS.map((preset) => {
		const button = makeButton(doc, {
			label: preset.name,
			text: preset.name,
			onClick: () => {
				handlers.applyPresentationTheme(preset.id);
				browse.close();
			},
		});
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
	for (const swatch of CHROME_THEMES) {
		const button = makeButton(doc, {
			label: t(swatch.labelKey),
			text: t(swatch.labelKey),
			onClick: () => {
				handlers.setTheme(swatch.theme);
				editTheme.close();
			},
		});
		editTheme.gallery.appendChild(
			withPreview(doc, button, swatch.theme?.colors?.primary ?? '#6b7280'),
		);
	}

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

	el.append(browse.el, editTheme.el, slideSize.btn, formatBackground.btn);

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
