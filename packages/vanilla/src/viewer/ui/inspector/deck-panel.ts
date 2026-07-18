import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeNumberField } from '../controls';
import type { DeckCard } from './deck-card-helpers';
import { makeDeckButton, makeRow, makeSection } from './deck-card-helpers';
import { createDeckPresentationCard } from './deck-presentation-card';
import { createThemeCard, createThemeOverrideCard } from './deck-theme-cards';
import type { InspectorDeckState, InspectorHandlers } from './types';

export interface DeckPanel {
	el: HTMLElement;
	update(state: InspectorDeckState): void;
	setVisible(visible: boolean): void;
}

export type DeckPanelHandlers = Pick<
	InspectorHandlers,
	| 'openDocumentProperties'
	| 'updatePresentationSettings'
	| 'applyThemeByPath'
	| 'updateActiveSlide'
	| 'updateCanvasSize'
>;

/** The editable SLIDE SIZE card (W/H numeric fields, React's `SlideSizeCard`). */
function createSlideSizeCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'updateCanvasSize'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.slideSize.title'));
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
	return {
		el,
		update(state) {
			size = state.canvasSize;
			wField.setValue(state.canvasSize.width);
			hField.setValue(state.canvasSize.height);
			wField.setDisabled(!state.editable);
			hField.setDisabled(!state.editable);
		},
	};
}

/** The read-only NOTES & HANDOUT card (React's `NotesHandoutCard`). */
function createNotesHandoutCard(doc: Document, t: Translator): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.documentProperties.notesHandoutHeading'));
	const sizeRow = makeRow(doc, t('pptx.documentProperties.notesSize'));
	const notesRow = makeRow(doc, t('pptx.master.notesMasterTitle'));
	const handoutRow = makeRow(doc, t('pptx.master.handoutMasterTitle'));
	body.append(sizeRow.el, notesRow.el, handoutRow.el);
	const na = t('pptx.digitalSignatures.notAvailable');
	const placeholders = (count: number | undefined): string =>
		count === undefined ? na : `${count} ${t('pptx.notesMaster.placeholders')}`;
	return {
		el,
		update(state) {
			// React's `NotesHandoutCard` renders "W × Hpx" (U+00D7, no spaces
			// around the digits and "px" flush against the height).
			sizeRow.value.textContent = state.notesCanvasSize
				? `${state.notesCanvasSize.width} × ${state.notesCanvasSize.height}px`
				: na;
			notesRow.value.textContent = placeholders(state.notesPlaceholderCount);
			handoutRow.value.textContent = placeholders(state.handoutPlaceholderCount);
		},
	};
}

/** The DOCUMENT card: title/author summary + the full-dialog launcher. */
function createDocumentCard(
	doc: Document,
	t: Translator,
	handlers: Pick<InspectorHandlers, 'openDocumentProperties'>,
): DeckCard {
	const { el, body } = makeSection(doc, t('pptx.documentProperties.documentHeading'));
	const titleRow = makeRow(doc, t('pptx.properties.titleLabel'));
	const authorRow = makeRow(doc, t('pptx.properties.author'));
	const openProps = makeDeckButton(doc, t('pptx.ribbon.documentProperties'), () =>
		handlers.openDocumentProperties(),
	);
	body.append(titleRow.el, authorRow.el, openProps);
	return {
		el,
		update(state) {
			titleRow.value.textContent = state.docTitle || '-';
			authorRow.value.textContent = state.docAuthor || '-';
		},
	};
}

/**
 * The no-selection Properties view, mirroring React's
 * `PresentationPropertiesPanel` section order: PRESENTATION, THEME, THEME
 * OVERRIDE, SLIDE SIZE, NOTES & HANDOUT, DOCUMENT.
 */
export function createDeckPanel(
	doc: Document,
	t: Translator,
	handlers: DeckPanelHandlers,
): DeckPanel {
	const el = createEl(doc, 'div', 'pptxv-inspector-deck');

	const cards: DeckCard[] = [
		createDeckPresentationCard(doc, t, handlers),
		createThemeCard(doc, t, handlers),
		createThemeOverrideCard(doc, t, handlers),
		createSlideSizeCard(doc, t, handlers),
		createNotesHandoutCard(doc, t),
		createDocumentCard(doc, t, handlers),
	];
	el.append(...cards.map((card) => card.el));

	return {
		el,
		update(state) {
			for (const card of cards) {
				card.update(state);
			}
		},
		setVisible(visible) {
			el.hidden = !visible;
		},
	};
}
