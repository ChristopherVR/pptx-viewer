import type { SlideSizeOrientation } from 'pptx-viewer-shared';
import {
	resolveSlideSizeSelection,
	SLIDE_SIZE_PRESETS,
	slideSizeFromPreset,
	withSlideSizeOrientation,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeNumberField } from '../controls';
import type { DeckCard } from './deck-card-helpers';
import { makeSection } from './deck-card-helpers';
import type { InspectorDeckState, InspectorHandlers } from './types';

/**
 * The SLIDE SIZE card: PowerPoint's preset dropdown, its Landscape/Portrait
 * toggle, and the raw W/H pixel inputs (React's `SlideSizeCard`).
 *
 * Which of the two sizes the card is describing is decided by the shared
 * `resolveSlideSizeSelection`, so the EMU size wins whenever it still agrees
 * with the pixels (Ledger is 12179300 EMU = 1278.5px, and a pixel round-trip
 * would cost the deck its `ppSlideSizeLedgerPaper` identity) and the pixels win
 * once the user has typed into W/H.
 */

/** The `<option>` value standing in for "no preset matches this size". */
const CUSTOM_VALUE = '__custom__';

export type SlideSizeHandlers = Pick<InspectorHandlers, 'updateCanvasSize' | 'updateSlideSize'>;

const ORIENTATIONS: readonly (readonly [SlideSizeOrientation, string])[] = [
	['landscape', 'pptx.slideSize.landscape'],
	['portrait', 'pptx.slideSize.portrait'],
];

export function createSlideSizeCard(
	doc: Document,
	t: Translator,
	handlers: SlideSizeHandlers,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.slideSize.title'));

	// ── Preset dropdown ──────────────────────────────────────────────────
	const presetLabel = createEl(doc, 'label', 'pptxv-field pptxv-field-select');
	const presetCaption = createEl(doc, 'span', 'pptxv-field-label');
	presetCaption.textContent = t('pptx.slideSize.presets');
	const preset = doc.createElement('select');
	preset.className = 'pptxv-field-select-input';
	preset.dataset.pptxSlideSizePreset = 'true';
	preset.setAttribute('aria-label', t('pptx.slideSize.presets'));
	// The custom entry is always present but hidden while a preset matches, so
	// the list never offers "Custom" as something a user could deliberately pick.
	const customOption = doc.createElement('option');
	customOption.value = CUSTOM_VALUE;
	customOption.textContent = t('pptx.slideSize.customSize');
	customOption.hidden = true;
	preset.appendChild(customOption);
	for (const entry of SLIDE_SIZE_PRESETS) {
		const option = doc.createElement('option');
		option.value = entry.labelKey;
		option.textContent = t(`pptx.slideSize.preset.${entry.labelKey}`);
		preset.appendChild(option);
	}
	presetLabel.append(presetCaption, preset);
	body.appendChild(presetLabel);

	// ── Landscape / Portrait toggle ──────────────────────────────────────
	const orientation = createEl(doc, 'div', 'pptxv-slide-size-orientation');
	orientation.setAttribute('role', 'group');
	orientation.setAttribute('aria-label', t('pptx.slideSize.orientation'));
	const orientationButtons = ORIENTATIONS.map(([value, labelKey]) => {
		const button = createEl(doc, 'button');
		button.type = 'button';
		button.dataset.pptxSlideSizeOrientation = value;
		button.textContent = t(labelKey);
		orientation.appendChild(button);
		return { value, button };
	});
	body.appendChild(orientation);

	// ── Raw W / H pixel inputs ───────────────────────────────────────────
	const grid = createEl(doc, 'div', 'pptxv-inspector-grid');
	body.appendChild(grid);
	let size = { width: 0, height: 0 };
	// React's `SlideSizeCard` labels the fields with the bare letters "W"/"H".
	const wField = makeNumberField(doc, {
		label: 'W',
		min: 1,
		onCommit: (value) => handlers.updateCanvasSize({ width: value, height: size.height }),
	});
	const hField = makeNumberField(doc, {
		label: 'H',
		min: 1,
		onCommit: (value) => handlers.updateCanvasSize({ width: size.width, height: value }),
	});
	grid.append(wField.el, hField.el);

	// The live selection, so a change handler can rotate/re-preset without
	// re-deriving it from a stale render.
	let selection = resolveSlideSizeSelection({
		current: undefined,
		canvas: { width: 1, height: 1 },
	});

	preset.addEventListener('change', () => {
		const picked = SLIDE_SIZE_PRESETS.find((entry) => entry.labelKey === preset.value);
		if (picked) {
			handlers.updateSlideSize(slideSizeFromPreset(picked, selection.orientation));
		}
	});
	// `forEach`, not `for..of`: a listener closure declared inside a loop
	// statement trips oxlint's `no-loop-func`.
	orientationButtons.forEach(({ value, button }) => {
		button.addEventListener('click', () =>
			handlers.updateSlideSize(withSlideSizeOrientation(selection.size, value)),
		);
	});

	return {
		el,
		update(state: InspectorDeckState) {
			size = state.canvasSize;
			selection = resolveSlideSizeSelection({
				current: state.slideSize,
				canvas: state.canvasSize,
			});
			customOption.hidden = selection.preset !== undefined;
			preset.value = selection.preset?.labelKey ?? CUSTOM_VALUE;
			preset.disabled = !state.editable;
			for (const { value, button } of orientationButtons) {
				const active = selection.orientation === value;
				button.classList.toggle('is-active', active);
				button.setAttribute('aria-pressed', String(active));
				button.disabled = !state.editable;
			}
			wField.setValue(state.canvasSize.width);
			hField.setValue(state.canvasSize.height);
			wField.setDisabled(!state.editable);
			hField.setDisabled(!state.editable);
		},
	};
}
