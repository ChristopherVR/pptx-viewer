import { describe, expect, it } from 'vitest';

import { BACKSTAGE_CARDS, backstageCardsFor } from './backstage-cards';

describe('backstage-cards', () => {
	it('lists the PowerPoint 97-2003 (.ppt) card on the Save As page, after the other OpenXML formats', () => {
		const ids = backstageCardsFor('saveAs').map((card) => card.id);
		expect(ids).toStrictEqual(['saveAsPptx', 'saveAsPpsx', 'saveAsPptm', 'saveAsPpt']);
	});

	it('gives the .ppt card a title/body and matching dictionary keys', () => {
		const card = BACKSTAGE_CARDS.saveAsPpt;
		expect(card.title).toBe('PowerPoint 97-2003 Presentation');
		expect(card.body.length).toBeGreaterThan(0);
		expect(card.titleKey).toBe('pptx.backstage.card.saveAsPpt.title');
		expect(card.bodyKey).toBe('pptx.backstage.card.saveAsPpt.body');
	});
});
