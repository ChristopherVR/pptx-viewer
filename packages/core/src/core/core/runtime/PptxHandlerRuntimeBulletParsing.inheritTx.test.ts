/**
 * Tests for parser+save round-trip of `<a:buFontTx/>`, `<a:buClrTx/>`,
 * `<a:buSzTx/>` (CT_TextParagraphProperties inherit-from-text bullet
 * variants).
 */
import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { applyBulletProperties } from './PptxHandlerRuntimeSaveParagraphHelpers';

describe('applyBulletProperties — Tx (inherit-from-text) variants', () => {
	it('emits <a:buFontTx/> when fontInherit is set', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { fontInherit: true, char: '•' });
		expect(props['a:buFontTx']).toStrictEqual({});
		expect(props['a:buFont']).toBeUndefined();
	});

	it('emits <a:buClrTx/> when colorInherit is set', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { colorInherit: true, char: '•' });
		expect(props['a:buClrTx']).toStrictEqual({});
		expect(props['a:buClr']).toBeUndefined();
	});

	it('emits <a:buSzTx/> when sizeInherit is set', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, { sizeInherit: true, char: '•' });
		expect(props['a:buSzTx']).toStrictEqual({});
		expect(props['a:buSzPct']).toBeUndefined();
		expect(props['a:buSzPts']).toBeUndefined();
	});

	it('inherit variants take precedence over explicit declarations', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, {
			fontInherit: true,
			fontFamily: 'Arial',
			colorInherit: true,
			color: '#FF0000',
			sizeInherit: true,
			sizePercent: 1.0,
			char: '•',
		});
		expect(props['a:buFontTx']).toStrictEqual({});
		expect(props['a:buFont']).toBeUndefined();
		expect(props['a:buClrTx']).toStrictEqual({});
		expect(props['a:buClr']).toBeUndefined();
		expect(props['a:buSzTx']).toStrictEqual({});
		expect(props['a:buSzPct']).toBeUndefined();
	});

	it('falls back to explicit declarations when no Tx flag is set', () => {
		const props: XmlObject = {};
		applyBulletProperties(props, {
			fontFamily: 'Arial',
			color: '#FF0000',
			sizePercent: 1.0,
			char: '•',
		});
		expect(props['a:buFont']).toBeDefined();
		expect(props['a:buClr']).toBeDefined();
		expect(props['a:buSzPct']).toBeDefined();
	});
});
