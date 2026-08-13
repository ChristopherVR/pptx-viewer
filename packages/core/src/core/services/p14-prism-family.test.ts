import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	prismFamilyFlags,
	prismFamilyTypeForFlags,
	prismFamilyTypeOfNode,
} from './p14-prism-family';

/**
 * MEASURED ground truth (PowerPoint authored `PpEntryEffect` 3910-3931 through
 * COM; the slide XML was dumped and the effect names read off the PowerPoint
 * type library, not inferred from the numbering):
 *
 *   3914 Cube    `<p14:prism/>`
 *   3918 Rotate  `<p14:prism isContent="1"/>`
 *   3922 Box     `<p14:prism isInverted="1"/>`
 *   3926 Orbit   `<p14:prism isContent="1" isInverted="1"/>`
 */
const MEASURED = [
	{ type: 'cube', node: {} },
	{ type: 'rotate', node: { '@_isContent': '1' } },
	{ type: 'box', node: { '@_isInverted': '1' } },
	{ type: 'orbit', node: { '@_isContent': '1', '@_isInverted': '1' } },
] as const;

describe('p14 prism family', () => {
	it.each(MEASURED)('reads $type back off the element PowerPoint writes', ({ type, node }) => {
		expect(prismFamilyTypeOfNode(node as XmlObject)).toBe(type);
	});

	it.each(MEASURED)('writes $type with the flags PowerPoint expects', ({ type, node }) => {
		const flags = prismFamilyFlags(type);
		expect(flags).toBeDefined();
		expect(flags!.isContent).toBe(node['@_isContent' as keyof typeof node] === '1');
		expect(flags!.isInverted).toBe(node['@_isInverted' as keyof typeof node] === '1');
		expect(prismFamilyTypeForFlags(flags!)).toBe(type);
	});

	it('treats a bare or absent element as Cube', () => {
		expect(prismFamilyTypeOfNode(undefined)).toBe('cube');
		expect(prismFamilyTypeOfNode({})).toBe('cube');
	});

	// `ST_OnOff` is not just "1": PowerPoint's own writer uses it, but a
	// hand-authored or third-party deck may spell the same boolean `true`.
	it.each(['1', 'true', 'on', 'TRUE'])('accepts %s as an ST_OnOff true', (raw) => {
		expect(prismFamilyTypeOfNode({ '@_isInverted': raw })).toBe('box');
	});

	it.each(['0', 'false', 'off', ''])('accepts %s as an ST_OnOff false', (raw) => {
		expect(prismFamilyTypeOfNode({ '@_isInverted': raw })).toBe('cube');
	});

	it('keeps the legacy generic prism token writing the bare (Cube) element', () => {
		expect(prismFamilyFlags('prism')).toStrictEqual({ isContent: false, isInverted: false });
	});

	it('does not claim transitions outside the family', () => {
		for (const type of ['flip', 'reveal', 'origami', 'fade']) {
			expect(prismFamilyFlags(type)).toBeUndefined();
		}
	});
});
