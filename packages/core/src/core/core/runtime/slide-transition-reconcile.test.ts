/**
 * Regression guards for the duplicate `p:transition` emitted on save.
 *
 * `CT_Slide` allows exactly one `p:transition`. PowerPoint 2010+ wraps it in a
 * slide-root `mc:AlternateContent` whenever it carries p14/p15/p159 markup, and
 * the loader reads it through that envelope - but the writer used to assign a
 * DIRECT `p:transition` on top, so a plain load -> save with no edits emitted
 * the transition three times (Choice + Fallback + a direct sibling appended
 * after `p:timing`, out of schema sequence as well). Proven on
 * `e2e/fixtures/issue-132-gradient-fill.pptx`: 26 of 29 slides.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { requireFixture } from '../../../__tests__/require-fixture';
import { PptxHandler } from '../../PptxHandler';
import type { XmlObject } from '../../types';
import { reconcileSlideTransition } from './slide-transition-reconcile';

const localName = (key: string): string => {
	const bare = key.startsWith('@_') ? key.slice(2) : key;
	const index = bare.lastIndexOf(':');
	return index < 0 ? bare : bare.slice(index + 1);
};

/** A slide root shaped exactly like the issue-132 deck's slide 1. */
function envelopedSlideNode(): { slideNode: XmlObject; source: XmlObject } {
	const source: XmlObject = {
		'@_spd': 'slow',
		'@_p14:dur': '2000',
		'@_advTm': '3000',
		'p:fade': { '@_thruBlk': '1' },
	};
	const slideNode: XmlObject = {
		'p:cSld': {},
		'p:clrMapOvr': { 'a:masterClrMapping': {} },
		'mc:AlternateContent': {
			'mc:Choice': { '@_Requires': 'p14', 'p:transition': source },
			'mc:Fallback': {
				'p:transition': { '@_spd': 'slow', '@_advTm': '3000', 'p:fade': { '@_thruBlk': '1' } },
			},
		},
		'p:timing': {},
	};
	return { slideNode, source };
}

describe('reconcileSlideTransition', () => {
	it('updates the envelope branch in place instead of adding a direct sibling', () => {
		const { slideNode, source } = envelopedSlideNode();
		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_spd': 'slow', '@_dur': '2000', '@_advTm': '3000', 'p:fade': {} },
			sourceNode: source,
			getLocalName: localName,
		});

		expect(slideNode['p:transition']).toBeUndefined();
		const envelope = slideNode['mc:AlternateContent'] as XmlObject;
		const choice = envelope['mc:Choice'] as XmlObject;
		expect(choice['p:transition']).toBeDefined();
		// The Fallback branch is left verbatim for legacy readers.
		expect((envelope['mc:Fallback'] as XmlObject)['p:transition']).toBeDefined();
	});

	it('keeps the p14-namespaced duration spelling inside a Requires="p14" Choice', () => {
		const { slideNode, source } = envelopedSlideNode();
		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_spd': 'slow', '@_dur': '2000', '@_advTm': '3000', 'p:fade': {} },
			sourceNode: source,
			getLocalName: localName,
		});

		const choice = (slideNode['mc:AlternateContent'] as XmlObject)['mc:Choice'] as XmlObject;
		const written = choice['p:transition'] as XmlObject;
		// `CT_SlideTransition` has no `dur` attribute; the 2010 duration is p14:dur.
		expect(written['@_p14:dur']).toBe('2000');
		expect(written['@_dur']).toBeUndefined();
	});

	it('drops the whole envelope when the transition is removed', () => {
		const { slideNode, source } = envelopedSlideNode();
		reconcileSlideTransition({
			slideNode,
			transitionNode: undefined,
			sourceNode: source,
			getLocalName: localName,
		});

		expect(slideNode['p:transition']).toBeUndefined();
		expect(slideNode['mc:AlternateContent']).toBeUndefined();
	});

	it('strips a stale enveloped copy when a brand-new transition is written directly', () => {
		const { slideNode } = envelopedSlideNode();
		reconcileSlideTransition({
			slideNode,
			transitionNode: { 'p:push': { '@_dir': 'u' } },
			// A transition authored in the editor carries no `rawTransition`.
			sourceNode: undefined,
			getLocalName: localName,
		});

		expect(slideNode['mc:AlternateContent']).toBeUndefined();
		expect(slideNode['p:transition']).toStrictEqual({ 'p:push': { '@_dir': 'u' } });
	});

	it('leaves a direct-child transition direct', () => {
		const source: XmlObject = { 'p:fade': {} };
		const slideNode: XmlObject = {
			'p:cSld': {},
			'p:clrMapOvr': {},
			'p:transition': source,
		};
		reconcileSlideTransition({
			slideNode,
			transitionNode: { 'p:wipe': { '@_dir': 'l' } },
			sourceNode: source,
			getLocalName: localName,
		});
		expect(slideNode['p:transition']).toStrictEqual({ 'p:wipe': { '@_dir': 'l' } });
	});

	// `CT_SlideTransition` declares no `dur`, and PowerPoint does not merely
	// tolerate the bare spelling - measured through COM, a deck saved with
	// `dur="2000"` reopens at the 0.5s default, so the authored duration is
	// silently lost. With `p14:dur` plus the `mc:Ignorable` declaration the same
	// deck reopens at 2s.
	it('writes the duration as p14:dur on a direct-child transition', () => {
		const source: XmlObject = { '@_p14:dur': '900', 'p:fade': {} };
		const slideNode: XmlObject = { 'p:cSld': {}, 'p:transition': source };

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '2000', 'p:fade': {} },
			sourceNode: source,
			getLocalName: localName,
		});

		const written = slideNode['p:transition'] as XmlObject;
		expect(written['@_p14:dur']).toBe('2000');
		expect(written['@_dur']).toBeUndefined();
	});

	it('declares p14 as ignorable when it introduces the namespaced duration', () => {
		const slideNode: XmlObject = { 'p:cSld': {} };

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '2000', '@_advClick': '1', 'p:fade': {} },
			// A transition authored in the editor has no source node at all.
			sourceNode: undefined,
			getLocalName: localName,
		});

		const written = slideNode['p:transition'] as XmlObject;
		expect(written['@_p14:dur']).toBe('2000');
		expect(written['@_dur']).toBeUndefined();
		expect(slideNode['@_xmlns:p14']).toBe(
			'http://schemas.microsoft.com/office/powerpoint/2010/main',
		);
		expect(String(slideNode['@_mc:Ignorable']).split(' ')).toContain('p14');
	});

	it('extends an existing mc:Ignorable list rather than replacing it', () => {
		const slideNode: XmlObject = {
			'p:cSld': {},
			'@_xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
			'@_mc:Ignorable': 'p15',
		};

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '1200', 'p:fade': {} },
			sourceNode: undefined,
			getLocalName: localName,
		});

		expect(slideNode['@_mc:Ignorable']).toBe('p15 p14');
	});

	it('leaves a transition with no duration free of MCE declarations', () => {
		const slideNode: XmlObject = { 'p:cSld': {} };

		reconcileSlideTransition({
			slideNode,
			transitionNode: { 'p:fade': {} },
			sourceNode: undefined,
			getLocalName: localName,
		});

		expect(slideNode['@_xmlns:p14']).toBeUndefined();
		expect(slideNode['@_mc:Ignorable']).toBeUndefined();
	});
});

// A transition carrying extension markup is only read by PowerPoint from inside
// an `mc:Choice`. Measured: the `p:extLst` form reopens with `EntryEffect = 0`
// (no transition), and a bare `<p14:ferris/>` direct child makes the file
// unopenable. Both were how this app wrote every one of the 34 extended types.
describe('reconcileSlideTransition envelope for extension markup', () => {
	function choiceOf(slideNode: XmlObject): XmlObject {
		const envelope = slideNode['mc:AlternateContent'] as XmlObject;
		return envelope['mc:Choice'] as XmlObject;
	}

	it('wraps a newly authored p14 transition in a Requires="p14" Choice', () => {
		const slideNode: XmlObject = { 'p:cSld': {}, 'p:timing': {} };

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '1500', 'p14:ferris': { '@_dir': 'l' } },
			sourceNode: undefined,
			getLocalName: localName,
		});

		expect(slideNode['p:transition']).toBeUndefined();
		const choice = choiceOf(slideNode);
		expect(choice['@_Requires']).toBe('p14');
		expect(choice['@_xmlns:p14']).toBe('http://schemas.microsoft.com/office/powerpoint/2010/main');
		const written = choice['p:transition'] as XmlObject;
		expect(written['p14:ferris']).toBeDefined();
		expect(written['@_p14:dur']).toBe('1500');
	});

	it('names the ELEMENT namespace in Requires, declaring the duration one too', () => {
		const slideNode: XmlObject = { 'p:cSld': {} };

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '2000', 'p159:morph': { '@_option': 'byObject' } },
			sourceNode: undefined,
			getLocalName: localName,
		});

		const choice = choiceOf(slideNode);
		// PowerPoint writes Requires="p159" for a morph even though the same
		// element carries p14:dur, so p14 must still be declared on the branch.
		expect(choice['@_Requires']).toBe('p159');
		expect(choice['@_xmlns:p159']).toBeDefined();
		expect(choice['@_xmlns:p14']).toBeDefined();
	});

	it('emits a base-namespace Fallback so older readers still transition', () => {
		const slideNode: XmlObject = { 'p:cSld': {} };

		reconcileSlideTransition({
			slideNode,
			transitionNode: {
				'@_spd': 'slow',
				'@_dur': '1500',
				'@_advTm': '3000',
				'p15:prstTrans': { '@_prst': 'origami' },
			},
			sourceNode: undefined,
			getLocalName: localName,
		});

		const envelope = slideNode['mc:AlternateContent'] as XmlObject;
		const fallback = (envelope['mc:Fallback'] as XmlObject)['p:transition'] as XmlObject;
		// Same base attributes, no extension markup, and a plain fade - exactly
		// what PowerPoint writes in the Fallback of every extended transition in
		// `issue-132-gradient-fill.pptx`.
		expect(fallback['@_spd']).toBe('slow');
		expect(fallback['@_advTm']).toBe('3000');
		expect(fallback['p:fade']).toBeDefined();
		expect(fallback['@_p14:dur']).toBeUndefined();
		expect(fallback['p15:prstTrans']).toBeUndefined();
	});

	it('keeps the envelope before p:timing in the CT_Slide sequence', () => {
		const slideNode: XmlObject = { 'p:cSld': {}, 'p:timing': {}, 'p:extLst': {} };

		reconcileSlideTransition({
			slideNode,
			transitionNode: { 'p14:vortex': {} },
			sourceNode: undefined,
			getLocalName: localName,
		});

		expect(Object.keys(slideNode)).toStrictEqual([
			'p:cSld',
			'mc:AlternateContent',
			'p:timing',
			'p:extLst',
		]);
	});

	it('emits exactly ONE transition, never an envelope plus a direct sibling', () => {
		const { slideNode, source } = envelopedSlideNode();

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '900', 'p14:reveal': { '@_dir': 'r' } },
			sourceNode: source,
			getLocalName: localName,
		});

		expect(slideNode['p:transition']).toBeUndefined();
		const choice = choiceOf(slideNode);
		expect((choice['p:transition'] as XmlObject)['p14:reveal']).toBeDefined();
		// The existing envelope is reused rather than a second one added.
		expect(Array.isArray(slideNode['mc:AlternateContent'])).toBeFalsy();
	});

	it('re-points Requires when the edit crosses extension families', () => {
		const { slideNode, source } = envelopedSlideNode();

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '900', 'p15:prstTrans': { '@_prst': 'origami' } },
			sourceNode: source,
			getLocalName: localName,
		});

		const choice = choiceOf(slideNode);
		expect(choice['@_Requires']).toBe('p15');
		expect(choice['@_xmlns:p15']).toBeDefined();
	});

	it('does not envelope a standard transition', () => {
		const slideNode: XmlObject = { 'p:cSld': {} };

		reconcileSlideTransition({
			slideNode,
			transitionNode: { '@_dur': '900', 'p:fade': {} },
			sourceNode: undefined,
			getLocalName: localName,
		});

		expect(slideNode['mc:AlternateContent']).toBeUndefined();
		expect(slideNode['p:transition']).toBeDefined();
	});
});

const fixture = requireFixture(
	fileURLToPath(
		new URL('../../../../../../e2e/fixtures/issue-132-gradient-fill.pptx', import.meta.url),
	),
);

describe('enveloped p:transition round-trip', () => {
	it('emits no more transitions than the source deck on a no-edit save', async () => {
		const bytes = readFileSync(fixture);
		const source = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		const handler = new PptxHandler();
		const data = await handler.load(source);
		const saved = await handler.save(data.slides);

		const before = await JSZip.loadAsync(source);
		const after = await JSZip.loadAsync(saved);
		const count = (xml: string): number => [...xml.matchAll(/<p:transition[\s>/]/gu)].length;

		let checked = 0;
		for (let index = 1; index <= data.slides.length; index++) {
			const part = `ppt/slides/slide${index}.xml`;
			const originalXml = await before.file(part)?.async('string');
			const savedXml = await after.file(part)?.async('string');
			if (!originalXml || !savedXml) {
				continue;
			}
			checked += 1;
			expect(count(savedXml), `${part} transition count`).toBe(count(originalXml));
		}
		expect(checked).toBeGreaterThan(20);
	}, 60_000);

	it('keeps the transition inside its envelope and in CT_Slide sequence', async () => {
		const bytes = readFileSync(fixture);
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
		const saved = await handler.save(data.slides);
		const xml = (await (
			await JSZip.loadAsync(saved)
		)
			.file('ppt/slides/slide1.xml')!
			.async('string')) as string;

		// No transition may follow `p:timing` (the old direct-sibling bug), and
		// none may carry the non-schema `dur` attribute.
		expect(xml.slice(xml.indexOf('</p:timing>'))).not.toContain('<p:transition');
		expect(xml).not.toMatch(/<p:transition[^>]*\sdur=/u);
		expect(xml).toMatch(/<p:transition[^>]*p14:dur="2000"/u);
		expect(xml.indexOf('<p:clrMapOvr')).toBeLessThan(xml.indexOf('<p:transition'));
		expect(xml.indexOf('<p:transition')).toBeLessThan(xml.indexOf('<p:timing'));
	}, 60_000);
});
