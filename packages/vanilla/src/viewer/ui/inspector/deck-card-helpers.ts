import { createEl } from '../../render';
import type { InspectorDeckState } from './types';

/**
 * Tiny shared DOM builders for the no-selection Properties cards
 * (`deck-panel.ts` + `deck-presentation-card.ts` + `deck-theme-cards.ts`),
 * extracted so each card file stays within the size budget.
 */

/** One card of the deck panel: a root element refreshed from deck state. */
export interface DeckCard {
	el: HTMLElement;
	update(state: InspectorDeckState): void;
}

/** A titled section (Presentation, Theme, Slide Size, Document, ...). */
export function makeSection(doc: Document, title: string): { el: HTMLElement; body: HTMLElement } {
	const el = createEl(doc, 'div', 'pptxv-inspector-section');
	const caption = createEl(doc, 'h4', 'pptxv-inspector-section-title');
	caption.textContent = title;
	el.appendChild(caption);
	const body = createEl(doc, 'div');
	el.appendChild(body);
	return { el, body };
}

/** A read-only label/value row. */
export function makeRow(doc: Document, label: string): { el: HTMLElement; value: HTMLElement } {
	const el = createEl(doc, 'div', 'pptxv-inspector-row');
	const labelEl = createEl(doc, 'span', 'pptxv-inspector-row-label');
	labelEl.textContent = label;
	const value = createEl(doc, 'span', 'pptxv-inspector-row-value');
	el.append(labelEl, value);
	return { el, value };
}

/** A small full-width action button in the deck-panel style. */
export function makeDeckButton(
	doc: Document,
	label: string,
	onClick: () => void,
): HTMLButtonElement {
	const btn = createEl(doc, 'button', 'pptxv-inspector-deck-btn');
	btn.type = 'button';
	btn.textContent = label;
	btn.addEventListener('click', onClick);
	return btn;
}
