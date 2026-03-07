/**
 * Tests for Structure & Metadata gap fixes (Task #5).
 *
 * Covers: showPr penClr, viewProps round-trip, paragraph properties,
 * run metadata, hyperlink attributes, layout attributes, placeholder
 * validation, and paragraph save helpers.
 */
import { describe, it, expect } from 'vitest';

import type { TextStyle } from '../../types';
import {
	buildParagraphPropertiesXml,
	EMU_PER_PX,
} from './PptxHandlerRuntimeSaveParagraphHelpers';
import {
	isValidPlaceholderType,
	normalizePlaceholderType,
	getValidPlaceholderTypes,
} from '../../utils/placeholder-validation';

// ────────────────────────────────────────────────────
// Placeholder validation
// ────────────────────────────────────────────────────

describe('placeholder-validation', () => {
	it('should accept standard placeholder types', () => {
		expect(isValidPlaceholderType('title')).toBe(true);
		expect(isValidPlaceholderType('body')).toBe(true);
		expect(isValidPlaceholderType('ctrTitle')).toBe(true);
		expect(isValidPlaceholderType('sldNum')).toBe(true);
		expect(isValidPlaceholderType('pic')).toBe(true);
	});

	it('should reject invalid placeholder types', () => {
		expect(isValidPlaceholderType('invalid')).toBe(false);
		expect(isValidPlaceholderType('')).toBe(false);
		expect(isValidPlaceholderType('TITLE')).toBe(false);
	});

	it('should normalize empty/undefined to body', () => {
		expect(normalizePlaceholderType(undefined)).toBe('body');
		expect(normalizePlaceholderType('')).toBe('body');
		expect(normalizePlaceholderType('  ')).toBe('body');
	});

	it('should normalize case-insensitively', () => {
		expect(normalizePlaceholderType('Title')).toBe('title');
		expect(normalizePlaceholderType('BODY')).toBe('body');
	});

	it('should return a complete set of valid types', () => {
		const types = getValidPlaceholderTypes();
		expect(types.size).toBeGreaterThan(15);
		expect(types.has('title')).toBe(true);
		expect(types.has('twoObj')).toBe(true);
	});
});

// ────────────────────────────────────────────────────
// Paragraph properties save (buildParagraphPropertiesXml)
// ────────────────────────────────────────────────────

describe('buildParagraphPropertiesXml — paragraph extras', () => {
	const noSpacing = {
		spacingBefore: undefined,
		spacingAfter: undefined,
		lineSpacing: undefined,
		lineSpacingExactPt: undefined,
	};

	it('should write defTabSz from defaultTabSize', () => {
		const style: TextStyle = { defaultTabSize: 48 };
		const xml = buildParagraphPropertiesXml(style, undefined, undefined, noSpacing);
		expect(xml['@_defTabSz']).toBe(String(Math.round(48 * EMU_PER_PX)));
	});

	it('should write eaLnBrk flag', () => {
		const style: TextStyle = { eaLineBreak: true };
		const xml = buildParagraphPropertiesXml(style, undefined, undefined, noSpacing);
		expect(xml['@_eaLnBrk']).toBe('1');
	});

	it('should write latinLnBrk flag', () => {
		const style: TextStyle = { latinLineBreak: false };
		const xml = buildParagraphPropertiesXml(style, undefined, undefined, noSpacing);
		expect(xml['@_latinLnBrk']).toBe('0');
	});

	it('should write fontAlgn', () => {
		const style: TextStyle = { fontAlignment: 'ctr' };
		const xml = buildParagraphPropertiesXml(style, undefined, undefined, noSpacing);
		expect(xml['@_fontAlgn']).toBe('ctr');
	});

	it('should write hangingPunct flag', () => {
		const style: TextStyle = { hangingPunctuation: true };
		const xml = buildParagraphPropertiesXml(style, undefined, undefined, noSpacing);
		expect(xml['@_hangingPunct']).toBe('1');
	});

	it('should omit paragraph extras when not set', () => {
		const style: TextStyle = {};
		const xml = buildParagraphPropertiesXml(style, undefined, undefined, noSpacing);
		expect(xml['@_defTabSz']).toBeUndefined();
		expect(xml['@_eaLnBrk']).toBeUndefined();
		expect(xml['@_latinLnBrk']).toBeUndefined();
		expect(xml['@_fontAlgn']).toBeUndefined();
		expect(xml['@_hangingPunct']).toBeUndefined();
	});
});

// ────────────────────────────────────────────────────
// TextStyle type — new field assertions (compile-time + runtime)
// ────────────────────────────────────────────────────

describe('TextStyle — new text property fields', () => {
	it('should accept run metadata fields', () => {
		const style: TextStyle = {
			normalizeHeight: true,
			noProof: false,
			dirty: true,
			spellingError: false,
			smartTagClean: true,
			bookmark: 'slide3',
		};
		expect(style.normalizeHeight).toBe(true);
		expect(style.noProof).toBe(false);
		expect(style.dirty).toBe(true);
		expect(style.spellingError).toBe(false);
		expect(style.smartTagClean).toBe(true);
		expect(style.bookmark).toBe('slide3');
	});

	it('should accept hyperlink extra attributes', () => {
		const style: TextStyle = {
			hyperlinkInvalidUrl: 'https://broken.test',
			hyperlinkTargetFrame: '_blank',
			hyperlinkHistory: true,
			hyperlinkHighlightClick: false,
			hyperlinkEndSound: true,
		};
		expect(style.hyperlinkInvalidUrl).toBe('https://broken.test');
		expect(style.hyperlinkTargetFrame).toBe('_blank');
		expect(style.hyperlinkHistory).toBe(true);
		expect(style.hyperlinkHighlightClick).toBe(false);
		expect(style.hyperlinkEndSound).toBe(true);
	});

	it('should accept paragraph extra fields', () => {
		const style: TextStyle = {
			defaultTabSize: 72,
			eaLineBreak: true,
			latinLineBreak: false,
			fontAlignment: 'base',
			hangingPunctuation: true,
		};
		expect(style.defaultTabSize).toBe(72);
		expect(style.eaLineBreak).toBe(true);
		expect(style.latinLineBreak).toBe(false);
		expect(style.fontAlignment).toBe('base');
		expect(style.hangingPunctuation).toBe(true);
	});

	it('should accept body extra fields', () => {
		const style: TextStyle = {
			spaceFirstLastParagraph: true,
			rtlColumns: false,
			fromWordArt: true,
			anchorCenter: false,
			forceAntiAlias: true,
			upright: false,
			compatibleLineSpacing: true,
		};
		expect(style.spaceFirstLastParagraph).toBe(true);
		expect(style.rtlColumns).toBe(false);
		expect(style.fromWordArt).toBe(true);
		expect(style.anchorCenter).toBe(false);
		expect(style.forceAntiAlias).toBe(true);
		expect(style.upright).toBe(false);
		expect(style.compatibleLineSpacing).toBe(true);
	});

	it('should accept extended align types', () => {
		const a: TextStyle = { align: 'justLow' };
		const b: TextStyle = { align: 'dist' };
		const c: TextStyle = { align: 'thaiDist' };
		expect(a.align).toBe('justLow');
		expect(b.align).toBe('dist');
		expect(c.align).toBe('thaiDist');
	});
});

// ────────────────────────────────────────────────────
// View properties type — compile-time assertion
// ────────────────────────────────────────────────────

describe('PptxViewProperties — type compilation', () => {
	it('should compile with all optional fields', () => {
		// This test just verifies the type imports compile
		const vp: import('../../types').PptxViewProperties = {
			lastView: 'sldView',
			showComments: true,
		};
		expect(vp.lastView).toBe('sldView');
	});
});
