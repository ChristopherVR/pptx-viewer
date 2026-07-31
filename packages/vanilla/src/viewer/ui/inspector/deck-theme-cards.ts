import type { ColorMapAliasKey, PptxThemeColorScheme } from 'pptx-viewer-core';
import {
	applyThemeOverrideToSlide,
	COLOR_MAP_ALIAS_KEYS,
	DEFAULT_COLOR_MAP,
	THEME_COLOR_SCHEME_KEYS,
} from 'pptx-viewer-core';
import { schemaLabel, THEME_COLOR_SLOT_LABEL_KEYS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { DeckCard } from './deck-card-helpers';
import { makeDeckButton, makeSection } from './deck-card-helpers';
import type { InspectorDeckState, InspectorHandlers } from './types';

/** Friendly labels for the colour-map alias keys (matches React's panel). */
const ALIAS_LABELS: Record<ColorMapAliasKey, string> = {
	bg1: 'Background 1',
	tx1: 'Text 1',
	bg2: 'Background 2',
	tx2: 'Text 2',
	accent1: 'Accent 1',
	accent2: 'Accent 2',
	accent3: 'Accent 3',
	accent4: 'Accent 4',
	accent5: 'Accent 5',
	accent6: 'Accent 6',
	hlink: 'Hyperlink',
	folHlink: 'Followed Hyperlink',
};

/**
 * The THEME card: dropdown of the packaged theme parts plus Apply First
 * Master / Apply All Masters (React's `ThemeSelectorCard`).
 */
export function createThemeCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'applyThemeByPath'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.documentProperties.themeHeading'));

	const select = doc.createElement('select');
	select.className = 'pptxv-field-select-input pptxv-inspector-theme-select';
	select.setAttribute('aria-label', t('pptx.documentProperties.themeHeading'));
	body.appendChild(select);

	const buttonRow = createEl(doc, 'div', 'pptxv-inspector-deck-btn-row');
	const applyFirst = makeDeckButton(doc, t('pptx.documentProperties.applyFirstMaster'), () =>
		handlers.applyThemeByPath(select.value, false),
	);
	const applyAll = makeDeckButton(doc, t('pptx.documentProperties.applyAllMasters'), () =>
		handlers.applyThemeByPath(select.value, true),
	);
	buttonRow.append(applyFirst, applyAll);
	body.appendChild(buttonRow);

	let renderedPaths = '';
	return {
		el,
		update(state) {
			const paths = state.themeOptions.map((opt) => opt.path).join('\n');
			if (paths !== renderedPaths) {
				renderedPaths = paths;
				const previous = select.value;
				select.replaceChildren();
				if (state.themeOptions.length === 0) {
					const empty = doc.createElement('option');
					empty.value = '';
					empty.textContent = t('pptx.documentProperties.noThemesOption');
					select.appendChild(empty);
				} else {
					for (const opt of state.themeOptions) {
						const optionEl = doc.createElement('option');
						optionEl.value = opt.path;
						optionEl.textContent = opt.name || opt.path.split('/').pop() || opt.path;
						select.appendChild(optionEl);
					}
					if (state.themeOptions.some((opt) => opt.path === previous)) {
						select.value = previous;
					}
				}
			}
			select.disabled = state.themeOptions.length === 0;
			const applyDisabled = !state.editable || !select.value;
			applyFirst.disabled = applyDisabled;
			applyAll.disabled = applyDisabled;
		},
	};
}

/**
 * The THEME OVERRIDE card: per-slide colour-map override toggle + alias
 * remapping rows (React's `SlideThemeOverridePanel`).
 */
export function createThemeOverrideCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'updateActiveSlide'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.themeOverride.heading'));

	let current: InspectorDeckState | undefined;

	const commitOverride = (nextOverride: Record<string, string> | undefined): void => {
		const slide = current?.activeSlide;
		if (!slide) {
			return;
		}
		if (!current?.colorScheme) {
			handlers.updateActiveSlide({ clrMapOverride: nextOverride });
			return;
		}
		const nextSlide = applyThemeOverrideToSlide(slide, current.colorScheme, nextOverride);
		handlers.updateActiveSlide({
			clrMapOverride: nextSlide.clrMapOverride,
			backgroundColor: nextSlide.backgroundColor,
			elements: nextSlide.elements,
		});
	};

	const toggleLabel = createEl(doc, 'label', 'pptxv-field pptxv-field-checkbox');
	const toggle = doc.createElement('input');
	toggle.type = 'checkbox';
	toggle.setAttribute('aria-label', t('pptx.themeOverride.enableOverride'));
	toggle.addEventListener('change', () => {
		if (toggle.checked) {
			commitOverride({ ...DEFAULT_COLOR_MAP });
		} else {
			commitOverride(undefined);
		}
	});
	const toggleText = createEl(doc, 'span', 'pptxv-field-label');
	toggleText.textContent = t('pptx.themeOverride.enableOverride');
	toggleLabel.append(toggle, toggleText);
	body.appendChild(toggleLabel);

	const rows = createEl(doc, 'div', 'pptxv-inspector-override-rows');
	body.appendChild(rows);

	const buildAliasRow = (
		alias: ColorMapAliasKey,
		override: Record<string, string>,
		editable: boolean,
	): HTMLElement => {
		const row = createEl(doc, 'div', 'pptxv-inspector-override-row');
		const label = createEl(doc, 'span', 'pptxv-inspector-row-label');
		label.textContent = ALIAS_LABELS[alias];
		label.title = ALIAS_LABELS[alias];
		const currentTarget = override[alias] ?? DEFAULT_COLOR_MAP[alias];
		const swatch = createEl(doc, 'span', 'pptxv-inspector-override-swatch');
		const resolved = current?.colorScheme?.[currentTarget as keyof PptxThemeColorScheme];
		if (typeof resolved === 'string' && resolved) {
			swatch.style.backgroundColor = `#${resolved.replace(/^#/u, '')}`;
		}
		const slotSelect = doc.createElement('select');
		slotSelect.className = 'pptxv-field-select-input';
		slotSelect.setAttribute('aria-label', ALIAS_LABELS[alias]);
		// The option VALUE stays the `a:clrScheme` slot name, because that is what
		// the override map stores; only the caption is spelled out, so the picker
		// no longer offers the user a choice between `dk1` and `folHlink`.
		for (const slot of THEME_COLOR_SCHEME_KEYS) {
			const optionEl = doc.createElement('option');
			optionEl.value = slot;
			optionEl.textContent = schemaLabel(THEME_COLOR_SLOT_LABEL_KEYS, slot, t);
			slotSelect.appendChild(optionEl);
		}
		slotSelect.value = currentTarget;
		slotSelect.disabled = !editable;
		slotSelect.addEventListener('change', () => {
			const next: Record<string, string> = { ...override, [alias]: slotSelect.value };
			for (const key of COLOR_MAP_ALIAS_KEYS) {
				if (!next[key]) {
					next[key] = DEFAULT_COLOR_MAP[key];
				}
			}
			commitOverride(next);
		});
		row.append(label, swatch, slotSelect);
		return row;
	};

	return {
		el,
		update(state) {
			current = state;
			el.hidden = !state.activeSlide;
			const override = state.activeSlide?.clrMapOverride;
			toggle.checked = override !== undefined;
			toggle.disabled = !state.editable;
			rows.replaceChildren();
			if (override) {
				for (const alias of COLOR_MAP_ALIAS_KEYS) {
					rows.appendChild(buildAliasRow(alias, override, state.editable));
				}
			}
		},
	};
}
