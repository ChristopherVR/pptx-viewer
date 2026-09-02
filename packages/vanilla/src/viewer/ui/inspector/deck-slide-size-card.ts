import type { SlideSizeEmu, SlideSizeOrientation } from 'pptx-viewer-shared';
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
import { createSlideSizeRescalePrompt } from './slide-size-rescale-prompt';
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

export type SlideSizeHandlers = Pick<
	InspectorHandlers,
	'updateCanvasSize' | 'updateSlideSize' | 'applySlideSizeRescale'
>;

/** Whether two EMU sizes describe the same slide dimensions. */
function sizesDiffer(a: SlideSizeEmu, b: SlideSizeEmu): boolean {
	return a.widthEmu !== b.widthEmu || a.heightEmu !== b.heightEmu;
}

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

	// ── Rescale prompt (PowerPoint's Design > Slide Size Maximize/Ensure Fit) ──
	// Shown instead of applying immediately when the deck has content and the
	// picked size differs from the current one; `pendingSize` is what a choice
	// there commits.
	let pendingSize: SlideSizeEmu | undefined;
	const rescalePrompt = createSlideSizeRescalePrompt(doc, t, (mode) => {
		if (pendingSize) {
			handlers.applySlideSizeRescale(pendingSize, mode);
		}
		pendingSize = undefined;
		rescalePrompt.hide();
	});
	body.appendChild(rescalePrompt.el);

	// The live selection, so a change handler can rotate/re-preset without
	// re-deriving it from a stale render.
	let selection = resolveSlideSizeSelection({
		current: undefined,
		canvas: { width: 1, height: 1 },
	});
	let hasDeckElements = false;

	/**
	 * Adopt `next` directly when the deck is empty or `next` matches the
	 * current size; otherwise stage it and show the Maximize/Ensure Fit prompt
	 * instead of touching the deck yet.
	 */
	function requestSizeChange(next: SlideSizeEmu): void {
		if (!hasDeckElements || !sizesDiffer(next, selection.size)) {
			handlers.updateSlideSize(next);
			return;
		}
		pendingSize = next;
		rescalePrompt.show();
	}

	preset.addEventListener('change', () => {
		const picked = SLIDE_SIZE_PRESETS.find((entry) => entry.labelKey === preset.value);
		if (picked) {
			requestSizeChange(slideSizeFromPreset(picked, selection.orientation));
		}
	});
	// `forEach`, not `for..of`: a listener closure declared inside a loop
	// statement trips oxlint's `no-loop-func`.
	orientationButtons.forEach(({ value, button }) => {
		button.addEventListener('click', () =>
			requestSizeChange(withSlideSizeOrientation(selection.size, value)),
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
			hasDeckElements = state.hasDeckElements;
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
			// The prompt targets a size that is no longer current (a save/undo/new
			// load landed underneath it); rather than commit a stale rescale, drop it.
			if (pendingSize && !state.editable) {
				pendingSize = undefined;
				rescalePrompt.hide();
			}
		},
	};
}
