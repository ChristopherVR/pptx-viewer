import { describe, expect, it } from 'vitest';

import { getPresentationContextMenuSections } from './presentation-context-menu';

describe('getPresentationContextMenuSections', () => {
	it('always includes Next/Previous and End Presentation', () => {
		const sections = getPresentationContextMenuSections({});
		const ids = sections.flatMap((section) => section.items.map((item) => item.id));
		expect(ids).toStrictEqual(['next', 'previous', 'endShow']);
	});

	it('adds See All Slides and Presenter View to the nav section when available', () => {
		const sections = getPresentationContextMenuSections({
			seeAllSlides: true,
			presenterView: true,
		});
		expect(sections[0]?.items.map((item) => item.id)).toStrictEqual([
			'next',
			'previous',
			'seeAllSlides',
			'presenterView',
		]);
	});

	it('adds a pointer-tools section only when pointerTools is set, eraseInk trailing it', () => {
		const withoutPointer = getPresentationContextMenuSections({});
		expect(withoutPointer.some((section) => section.id === 'pointer')).toBeFalsy();

		const withPointer = getPresentationContextMenuSections({ pointerTools: true, eraseInk: true });
		const pointerSection = withPointer.find((section) => section.id === 'pointer');
		expect(pointerSection?.items.map((item) => item.id)).toStrictEqual([
			'pointerArrow',
			'pointerPen',
			'pointerHighlighter',
			'pointerLaser',
			'eraseInk',
		]);
	});

	it('omits eraseInk when eraseInk capability is not set, even with pointerTools on', () => {
		const sections = getPresentationContextMenuSections({ pointerTools: true });
		const pointerSection = sections.find((section) => section.id === 'pointer');
		expect(pointerSection?.items.map((item) => item.id)).not.toContain('eraseInk');
	});

	it('adds a screen section with only the blank modes the caller supports', () => {
		const blackOnly = getPresentationContextMenuSections({ blankBlack: true });
		const blackSection = blackOnly.find((section) => section.id === 'screen');
		expect(blackSection?.items.map((item) => item.id)).toStrictEqual(['blankBlack']);

		const both = getPresentationContextMenuSections({ blankBlack: true, blankWhite: true });
		const bothSection = both.find((section) => section.id === 'screen');
		expect(bothSection?.items.map((item) => item.id)).toStrictEqual(['blankBlack', 'blankWhite']);

		const neither = getPresentationContextMenuSections({});
		expect(neither.some((section) => section.id === 'screen')).toBeFalsy();
	});

	it('ends with the End Presentation section regardless of capabilities', () => {
		const sections = getPresentationContextMenuSections({
			seeAllSlides: true,
			presenterView: true,
			pointerTools: true,
			eraseInk: true,
			blankBlack: true,
			blankWhite: true,
		});
		expect(sections.at(-1)).toStrictEqual({
			id: 'end',
			items: [{ id: 'endShow', labelKey: 'pptx.presenter.endPresentation' }],
		});
	});
});
