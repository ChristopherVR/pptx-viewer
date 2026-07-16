import { THEME_PRESETS } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';
import { vermilionDarkTheme, vermilionLightTheme } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonDesignHandlers } from '../ribbon-types';

/** One theme-gallery swatch: a label plus the `ViewerTheme` it applies (`undefined` resets to default). */
interface ThemeSwatch {
	labelKey: string;
	theme: ViewerTheme | undefined;
}

const THEME_SWATCHES: readonly ThemeSwatch[] = [
	{ labelKey: 'pptx.ribbon.theme.default', theme: undefined },
	{ labelKey: 'pptx.ribbon.theme.light', theme: vermilionLightTheme },
	{ labelKey: 'pptx.ribbon.theme.dark', theme: vermilionDarkTheme },
];

export interface DesignTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
}

/**
 * The Design ribbon tab: a theme-preset gallery swapping the viewer chrome's
 * `ViewerTheme` (light/dark "vermilion", see `theme/presets.ts`) via
 * `RibbonDesignHandlers.setTheme` (the same mechanism `PptxViewer.setTheme`
 * exposes publicly), plus a toggle for the docked Format Background panel
 * (`format-background-panel.ts`), which edits the current slide's solid
 * background colour through `EditActions`.
 *
 * Note: this theme gallery swaps the *viewer UI chrome* palette, not
 * PowerPoint's own deck colour-scheme/design-theme system (that machinery
 * exists in `pptx-viewer-core` as `THEME_PRESETS` / `applyThemeToData` but
 * isn't wired into this binding's store yet; see the wave's final report).
 */
export function createDesignTab(
	doc: Document,
	t: Translator,
	handlers: RibbonDesignHandlers,
	onToggleFormatBackground: () => void,
): DesignTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	const themeGallery = createEl(doc, 'div', 'pptxv-theme-gallery');
	for (const swatch of THEME_SWATCHES) {
		const btn = makeButton(doc, {
			label: t(swatch.labelKey),
			text: t(swatch.labelKey),
			onClick: () => handlers.setTheme(swatch.theme),
		});
		const preview = createEl(doc, 'span', 'pptxv-theme-swatch-preview');
		preview.style.background = swatch.theme?.colors?.primary ?? '#6b7280';
		btn.btn.prepend(preview);
		themeGallery.appendChild(btn.btn);
	}
	el.appendChild(themeGallery);

	const deckThemes = createEl(doc, 'div', 'pptxv-theme-gallery pptxv-deck-theme-gallery');
	const deckThemeButtons = THEME_PRESETS.map((preset) => {
		const btn = makeButton(doc, {
			label: preset.name,
			text: preset.name,
			onClick: () => handlers.applyPresentationTheme(preset.id),
		});
		const preview = createEl(doc, 'span', 'pptxv-theme-swatch-preview');
		preview.style.background = `linear-gradient(135deg, ${preset.colorScheme.accent1}, ${preset.colorScheme.accent2})`;
		btn.btn.prepend(preview);
		deckThemes.appendChild(btn.btn);
		return btn;
	});
	el.appendChild(deckThemes);

	const formatBackground = makeButton(doc, {
		label: t('pptx.ribbon.formatBackground'),
		text: t('pptx.ribbon.formatBackground'),
		onClick: onToggleFormatBackground,
	});
	el.appendChild(formatBackground.btn);

	return {
		el,
		setEditable(editable) {
			formatBackground.setDisabled(!editable);
			for (const button of deckThemeButtons) {
				button.setDisabled(!editable);
			}
		},
	};
}
