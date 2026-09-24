/**
 * @module ppt/writer/metro-blob-xml.test
 */
import { describe, expect, it } from 'vitest';

import { findMetroFragment, referencedRelIds } from './metro-blob-xml';

const SLIDE_OPEN = '<p:sld xmlns:a="urn:a" xmlns:r="urn:r" xmlns:p="urn:p"><p:cSld><p:spTree>';
const SLIDE_CLOSE = '</p:spTree></p:cSld></p:sld>';

const INK =
	'<mc:AlternateContent xmlns:mc="urn:mc" xmlns:p14="urn:p14"><mc:Choice Requires="p14">' +
	'<p:contentPart p14:bwMode="auto" r:id="rId2"><p14:nvContentPartPr><p14:cNvPr id="7" name="Ink 6"/>' +
	'</p14:nvContentPartPr></p:contentPart></mc:Choice><mc:Fallback><p:sp><p:nvSpPr>' +
	'<p:cNvPr id="7" name="Ink 6"/></p:nvSpPr></p:sp></mc:Fallback></mc:AlternateContent>';

const FRAME =
	'<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Diagram 1"/></p:nvGraphicFramePr>' +
	'<a:graphic><a:graphicData uri="dgm"><dgm:relIds xmlns:dgm="urn:dgm" r:dm="rId3" r:lo="rId4"/>' +
	'</a:graphicData></a:graphic></p:graphicFrame>';

const SLIDE = SLIDE_OPEN + INK + FRAME + SLIDE_CLOSE;

describe('findMetroFragment', () => {
	it('returns an ink content part as a self-contained p:contentPart root', () => {
		const fragment = findMetroFragment(SLIDE, { shapeId: '7' });
		expect(fragment?.kind).toBe('ink');
		expect(fragment?.shapeId).toBe('7');
		expect(fragment?.relIds).toStrictEqual(['rId2']);
		// Every prefix the fragment uses is declared on its own root.
		for (const prefix of ['p', 'r', 'a', 'mc', 'p14']) {
			expect(fragment?.xml).toMatch(new RegExp(`^<p:contentPart[^>]* xmlns:${prefix}="`, 'u'));
		}
		expect(fragment?.xml.endsWith('</p:contentPart>')).toBeTruthy();
	});

	it('renames a graphic frame to p:E2oFrame, as PowerPoint does', () => {
		const fragment = findMetroFragment(SLIDE, { shapeId: '4' });
		expect(fragment?.kind).toBe('graphicFrame');
		expect(fragment?.xml.startsWith('<p:E2oFrame ')).toBeTruthy();
		expect(fragment?.xml.endsWith('</p:E2oFrame>')).toBeTruthy();
		expect(fragment?.xml).not.toContain('graphicFrame');
		expect(fragment?.relIds).toStrictEqual(['rId3', 'rId4']);
	});

	it('falls back to a unique cNvPr name when no shape id is known', () => {
		expect(findMetroFragment(SLIDE, { name: 'Diagram 1' })?.shapeId).toBe('4');
	});

	it('returns undefined when the element is absent', () => {
		expect(findMetroFragment(SLIDE, { shapeId: '99' })).toBeUndefined();
		expect(findMetroFragment(SLIDE, {})).toBeUndefined();
	});
});

describe('referencedRelIds', () => {
	it('collects every r:* attribute value once', () => {
		expect(referencedRelIds('<x r:id="rId1"><y r:embed="rId2" r:link="rId1"/></x>')).toStrictEqual([
			'rId1',
			'rId2',
		]);
	});
});
