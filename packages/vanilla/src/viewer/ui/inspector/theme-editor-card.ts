import type { PptxThemeColorScheme, PptxThemeFontScheme } from 'pptx-viewer-core';
import { DEFAULT_THEME_COLOR_SCHEME } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { DeckCard } from './deck-card-helpers';
import { makeDeckButton, makeSection } from './deck-card-helpers';
import {
	createColorSlotGrid,
	createFontField,
	createPresetGallery,
	setFontValue,
	themeHex,
} from './theme-editor-fields';
import type { InspectorDeckState, InspectorHandlers } from './types';

const DEFAULT_MAJOR_FONT = 'Calibri Light';
const DEFAULT_MINOR_FONT = 'Calibri';

/**
 * The THEME EDITOR card (React's `ThemeEditorPanel` + `ThemeColorSchemeEditor`,
 * Vue's `ThemeEditorPanel.vue`, Angular's `theme-editor-fields.component`): the
 * deck theme's name, the 12 scheme colours, the heading/body font pair and the
 * Office preset gallery, with a live heading/body preview.
 *
 * Edits are staged locally and only pushed on "Apply to Presentation": applying
 * a theme re-resolves every slide's colours, so doing that on each swatch drag
 * would spam the undo history with a dozen full-deck rewrites. "Reset" drops
 * the staged edits back to the deck's loaded theme.
 */
export function createThemeEditorCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'applyThemeEdit'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.themeEditor.title'));

	let loaded: { colorScheme?: PptxThemeColorScheme; major: string; minor: string; name: string } = {
		colorScheme: undefined,
		major: DEFAULT_MAJOR_FONT,
		minor: DEFAULT_MINOR_FONT,
		name: 'Custom Theme',
	};
	let colors: PptxThemeColorScheme = { ...DEFAULT_THEME_COLOR_SCHEME };
	let major = DEFAULT_MAJOR_FONT;
	let minor = DEFAULT_MINOR_FONT;
	let editable = false;
	/** True once the user touched a field: keeps deck refreshes from clobbering. */
	let dirty = false;

	const nameField = createEl(doc, 'label', 'pptxv-field pptxv-theme-name');
	const nameCaption = createEl(doc, 'span', 'pptxv-field-label');
	nameCaption.textContent = t('pptx.themeEditor.themeName');
	const name = doc.createElement('input');
	name.type = 'text';
	name.className = 'pptxv-field-input';
	name.placeholder = t('pptx.themeEditor.themeNamePlaceholder');
	name.setAttribute('aria-label', t('pptx.themeEditor.themeName'));
	name.addEventListener('keydown', (event) => event.stopPropagation());
	name.addEventListener('input', () => {
		dirty = true;
	});
	nameField.append(nameCaption, name);

	const presets = createPresetGallery(doc, t, (preset) => {
		colors = { ...preset.colorScheme };
		major = preset.majorFont;
		minor = preset.minorFont;
		name.value = preset.name;
		dirty = true;
		paint();
	});

	const slots = createColorSlotGrid(doc, t, (key, hex) => {
		colors = { ...colors, [key]: hex };
		dirty = true;
		paint();
	});

	const majorField = createFontField(doc, t('pptx.themeEditor.headingFont'), (font) => {
		major = font;
		dirty = true;
		paint();
	});
	const minorField = createFontField(doc, t('pptx.themeEditor.bodyFont'), (font) => {
		minor = font;
		dirty = true;
		paint();
	});

	const preview = createEl(doc, 'div', 'pptxv-theme-preview');
	const previewHeading = createEl(doc, 'span', 'pptxv-theme-preview-heading');
	previewHeading.textContent = t('pptx.themeEditor.headingSample');
	const previewBody = createEl(doc, 'span', 'pptxv-theme-preview-body');
	previewBody.textContent = t('pptx.themeEditor.bodySample');
	preview.append(previewHeading, previewBody);

	const actions = createEl(doc, 'div', 'pptxv-inspector-deck-btn-row');
	const apply = makeDeckButton(doc, t('pptx.themeEditor.applyToPresentation'), () => {
		const fontScheme: PptxThemeFontScheme = {
			majorFont: { latin: major },
			minorFont: { latin: minor },
		};
		handlers.applyThemeEdit({ colorScheme: colors, fontScheme, name: name.value });
		dirty = false;
	});
	const reset = makeDeckButton(doc, t('pptx.themeEditor.reset'), () => {
		seedFromLoaded();
		dirty = false;
		paint();
	});
	actions.append(apply, reset);

	body.append(nameField, presets.el, slots.el, majorField.el, minorField.el, preview, actions);

	/** Reflect the staged theme into every control (no state changes). */
	function paint(): void {
		slots.update(colors, editable);
		presets.update(name.value, editable);
		setFontValue(majorField.select, major);
		setFontValue(minorField.select, minor);
		majorField.select.disabled = !editable;
		minorField.select.disabled = !editable;
		name.disabled = !editable;
		apply.disabled = !editable;
		reset.disabled = !editable;
		preview.style.background = themeHex(colors.lt1, '#ffffff');
		previewHeading.style.color = themeHex(colors.dk2, '#000000');
		previewHeading.style.fontFamily = major;
		previewBody.style.color = themeHex(colors.dk1, '#000000');
		previewBody.style.fontFamily = minor;
	}

	/** Re-stage the deck's loaded theme, filling gaps from the Office scheme. */
	function seedFromLoaded(): void {
		colors = { ...DEFAULT_THEME_COLOR_SCHEME, ...(loaded.colorScheme ?? {}) };
		major = loaded.major;
		minor = loaded.minor;
		name.value = loaded.name;
	}

	return {
		el,
		update(state: InspectorDeckState) {
			editable = state.editable;
			loaded = {
				colorScheme: state.colorScheme,
				major: state.fontScheme?.majorFont?.latin ?? DEFAULT_MAJOR_FONT,
				minor: state.fontScheme?.minorFont?.latin ?? DEFAULT_MINOR_FONT,
				name: state.themeName ?? 'Custom Theme',
			};
			if (!dirty) {
				seedFromLoaded();
			}
			paint();
		},
	};
}
