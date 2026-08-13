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
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

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
});

const fixture = fileURLToPath(
	new URL('../../../../../../e2e/fixtures/issue-132-gradient-fill.pptx', import.meta.url),
);

describe('enveloped p:transition round-trip', () => {
	it.skipIf(!existsSync(fixture))(
		'emits no more transitions than the source deck on a no-edit save',
		async () => {
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
		},
		60_000,
	);

	it.skipIf(!existsSync(fixture))(
		'keeps the transition inside its envelope and in CT_Slide sequence',
		async () => {
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
		},
		60_000,
	);
});
