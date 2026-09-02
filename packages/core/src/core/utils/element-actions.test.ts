import { describe, it, expect } from 'vitest';

import type { PptxAction, ElementAction, PptxElement } from '../types';
import {
	pptxActionToElementAction,
	elementActionToPptxAction,
	elementHasAction,
} from './element-actions';

// ---------------------------------------------------------------------------
// pptxActionToElementAction
// ---------------------------------------------------------------------------

describe('pptxActionToElementAction', () => {
	it('returns slide action for hlinksldjump with targetSlideIndex', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: 3,
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'slide', slideIndex: 3 });
	});

	it('returns nextSlide for hlinkshowjump?jump=nextslide', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://hlinkshowjump?jump=nextslide',
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'nextSlide' });
	});

	it('returns prevSlide for hlinkshowjump?jump=previousslide', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://hlinkshowjump?jump=previousslide',
		};
		const result = pptxActionToElementAction(pptxAction, 'hover');
		expect(result).toStrictEqual({ trigger: 'hover', type: 'prevSlide' });
	});

	it('returns firstSlide for hlinkshowjump?jump=firstslide', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://hlinkshowjump?jump=firstslide',
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'firstSlide' });
	});

	it('returns lastSlide for hlinkshowjump?jump=lastslide', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://hlinkshowjump?jump=lastslide',
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'lastSlide' });
	});

	it('returns endShow for hlinkshowjump?jump=endshow', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://hlinkshowjump?jump=endshow',
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'endShow' });
	});

	it('returns url action for external URL without hlinksldjump', () => {
		const pptxAction: PptxAction = {
			url: 'https://example.com',
			action: '',
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({
			trigger: 'click',
			type: 'url',
			url: 'https://example.com',
		});
	});

	it('returns none action for empty action with no url', () => {
		const pptxAction: PptxAction = {};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'none' });
	});

	it('ignores url when action is hlinksldjump but targetSlideIndex is missing', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://hlinksldjump',
			url: 'https://example.com',
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'none' });
	});

	it('is case-insensitive for action string', () => {
		const pptxAction: PptxAction = {
			action: 'ppaction://HLINKSLDJUMP',
			targetSlideIndex: 0,
		};
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'slide', slideIndex: 0 });
	});

	it('returns lastViewed for hlinkshowjump?jump=lastslideviewed, not lastSlide', () => {
		const pptxAction: PptxAction = { action: 'ppaction://hlinkshowjump?jump=lastslideviewed' };
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'lastViewed' });
	});

	it('returns customShow with id and returnAfter for customshow?id=N&return=true', () => {
		const pptxAction: PptxAction = { action: 'ppaction://customshow?id=3&return=true' };
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({
			trigger: 'click',
			type: 'customShow',
			customShowId: '3',
			returnAfter: true,
		});
	});

	it('returns customShow without returnAfter when &return is absent', () => {
		const pptxAction: PptxAction = { action: 'ppaction://customshow?id=7' };
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({
			trigger: 'click',
			type: 'customShow',
			customShowId: '7',
			returnAfter: false,
		});
	});

	it('returns openFile with the resolved url for hlinkfile', () => {
		const pptxAction: PptxAction = { action: 'ppaction://hlinkfile', url: 'report.docx' };
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'openFile', url: 'report.docx' });
	});

	it('returns openPresentation with the resolved url for hlinkpres', () => {
		const pptxAction: PptxAction = { action: 'ppaction://hlinkpres', url: 'other.pptx' };
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({
			trigger: 'click',
			type: 'openPresentation',
			url: 'other.pptx',
		});
	});

	it('returns playMedia for ppaction://media', () => {
		const pptxAction: PptxAction = { action: 'ppaction://media' };
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'playMedia' });
	});

	it('returns oleVerb with the parsed verb number for ppaction://ole?verb=N', () => {
		const pptxAction: PptxAction = { action: 'ppaction://ole?verb=-1' };
		const result = pptxActionToElementAction(pptxAction, 'click');
		expect(result).toStrictEqual({ trigger: 'click', type: 'oleVerb', oleVerb: -1 });
	});
});

// ---------------------------------------------------------------------------
// elementActionToPptxAction
// ---------------------------------------------------------------------------

describe('elementActionToPptxAction', () => {
	it('returns undefined for none action', () => {
		const ea: ElementAction = { trigger: 'click', type: 'none' };
		expect(elementActionToPptxAction(ea)).toBeUndefined();
	});

	it('returns url PptxAction for url type', () => {
		const ea: ElementAction = {
			trigger: 'click',
			type: 'url',
			url: 'https://example.com',
		};
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ url: 'https://example.com' });
	});

	it('returns slide PptxAction for slide type', () => {
		const ea: ElementAction = {
			trigger: 'click',
			type: 'slide',
			slideIndex: 5,
		};
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({
			action: 'ppaction://hlinksldjump',
			targetSlideIndex: 5,
		});
	});

	it('returns firstSlide PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'firstSlide' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=firstslide',
		});
	});

	it('returns lastSlide PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'lastSlide' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=lastslide',
		});
	});

	it('returns nextSlide PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'nextSlide' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=nextslide',
		});
	});

	it('returns prevSlide PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'prevSlide' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=previousslide',
		});
	});

	it('returns endShow PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'endShow' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({
			action: 'ppaction://hlinkshowjump?jump=endshow',
		});
	});

	it('returns lastViewed PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'lastViewed' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://hlinkshowjump?jump=lastslideviewed' });
	});

	it('returns customShow PptxAction with id and return=true', () => {
		const ea: ElementAction = {
			trigger: 'click',
			type: 'customShow',
			customShowId: '3',
			returnAfter: true,
		};
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://customshow?id=3&return=true' });
	});

	it('omits &return for customShow when returnAfter is falsy', () => {
		const ea: ElementAction = { trigger: 'click', type: 'customShow', customShowId: '3' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://customshow?id=3' });
	});

	it('returns openFile PptxAction carrying the url for relationship resolution', () => {
		const ea: ElementAction = { trigger: 'click', type: 'openFile', url: 'report.docx' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://hlinkfile', url: 'report.docx' });
	});

	it('returns openPresentation PptxAction carrying the url for relationship resolution', () => {
		const ea: ElementAction = { trigger: 'click', type: 'openPresentation', url: 'other.pptx' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://hlinkpres', url: 'other.pptx' });
	});

	it('returns playMedia PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'playMedia' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://media' });
	});

	it('returns oleVerb PptxAction', () => {
		const ea: ElementAction = { trigger: 'click', type: 'oleVerb', oleVerb: -1 };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://ole?verb=-1' });
	});

	it('defaults oleVerb to 0 when unset', () => {
		const ea: ElementAction = { trigger: 'click', type: 'oleVerb' };
		const result = elementActionToPptxAction(ea);
		expect(result).toStrictEqual({ action: 'ppaction://ole?verb=0' });
	});

	it('round-trips every new verb through parse then serialize', () => {
		const cases: PptxAction[] = [
			{ action: 'ppaction://hlinkshowjump?jump=lastslideviewed' },
			{ action: 'ppaction://customshow?id=3&return=true' },
			{ action: 'ppaction://customshow?id=7' },
			{ action: 'ppaction://media' },
			{ action: 'ppaction://ole?verb=2' },
		];
		for (const original of cases) {
			const elementAction = pptxActionToElementAction(original, 'click');
			const roundTripped = elementActionToPptxAction(elementAction);
			expect(roundTripped?.action).toBe(original.action);
		}
	});
});

// ---------------------------------------------------------------------------
// elementHasAction
// ---------------------------------------------------------------------------

describe('elementHasAction', () => {
	it('returns true when element has actionClick', () => {
		const element = {
			actionClick: { action: 'ppaction://hlinksldjump' },
		} as unknown as PptxElement;
		expect(elementHasAction(element)).toBeTruthy();
	});

	it('returns true when element has actionHover', () => {
		const element = { actionHover: { url: 'https://example.com' } } as unknown as PptxElement;
		expect(elementHasAction(element)).toBeTruthy();
	});

	it('returns false when element has no actions', () => {
		const element = {} as unknown as PptxElement;
		expect(elementHasAction(element)).toBeFalsy();
	});

	it('returns false when actions are undefined', () => {
		const element = { actionClick: undefined, actionHover: undefined } as unknown as PptxElement;
		expect(elementHasAction(element)).toBeFalsy();
	});

	it('returns true when both click and hover actions exist', () => {
		const element = {
			actionClick: { action: 'ppaction://hlinksldjump' },
			actionHover: { url: 'https://example.com' },
		} as unknown as PptxElement;
		expect(elementHasAction(element)).toBeTruthy();
	});

	it('returns false for null-ish action values', () => {
		const element = { actionClick: null, actionHover: null } as unknown as PptxElement;
		expect(elementHasAction(element)).toBeFalsy();
	});
});
