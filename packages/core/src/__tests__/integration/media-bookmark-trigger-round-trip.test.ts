/**
 * Media-bookmark triggers ("Trigger > On Bookmark") against a deck PowerPoint
 * itself authored over COM (`e2e/fixtures/media-bookmark-trigger.pptx`: a
 * video with bookmarks BM1/BM2, "Bookmark Target" fading in on BM1, and an
 * unanimated "Second Shape").
 *
 * PowerPoint keeps such a timing tree in a slide-root `mc:AlternateContent`
 * (`mc:Choice Requires="p14"` with the bookmark sequences, `mc:Fallback`
 * without them). The loader used to reject that Choice and read the
 * Fallback, dropping every bookmark trigger, and any save that touched the
 * animations wrote a second and third `p:timing` beside the envelope.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxData, PptxElement } from '../../index';

const fixture = fileURLToPath(
	new URL('../../../../../e2e/fixtures/media-bookmark-trigger.pptx', import.meta.url),
);

async function load(bytes: Uint8Array): Promise<{ handler: PptxHandler; data: PptxData }> {
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, data };
}

async function slideXml(bytes: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	return zip.file('ppt/slides/slide1.xml')!.async('string');
}

function byName(elements: PptxElement[], name: string): PptxElement {
	// The video is the deck's only media element (its parsed name is not kept).
	const found = elements.find((e) => (name === 'Clip' ? e.type === 'media' : e.name === name));
	if (!found) {
		throw new Error(`missing element ${name}`);
	}
	return found;
}

function count(haystack: string, needle: string | RegExp): number {
	return (haystack.match(needle instanceof RegExp ? needle : new RegExp(needle, 'g')) ?? []).length;
}

describe('media bookmark triggers', () => {
	it('reads the p14 timing branch, so the PowerPoint-authored trigger survives load', async () => {
		const { data } = await load(new Uint8Array(readFileSync(fixture)));
		const slide = data.slides[0]!;
		const target = byName(slide.elements, 'Bookmark Target');
		const clip = byName(slide.elements, 'Clip');
		const effect = slide.nativeAnimations?.find((a) => a.targetId === target.id);
		expect(effect?.trigger).toBe('onMediaBookmark');
		expect(effect?.triggerShapeId).toBe(clip.id);
		expect(effect?.triggerBookmark).toBe('BM1');
		expect(effect?.groupAutoStart).toBeTruthy();
		expect(effect?.startConditions?.[0]?.bookmarkTarget).toStrictEqual({
			shapeId: clip.id,
			bookmarkName: 'BM1',
		});
	});

	it('writes an authored bookmark trigger the way PowerPoint does and reloads it', async () => {
		const { handler, data } = await load(new Uint8Array(readFileSync(fixture)));
		const slide = data.slides[0]!;
		const second = byName(slide.elements, 'Second Shape');
		const clip = byName(slide.elements, 'Clip');
		slide.animations = [
			{
				elementId: second.id,
				entrance: 'fadeIn',
				durationMs: 500,
				trigger: 'onMediaBookmark',
				triggerShapeId: clip.id,
				triggerBookmark: 'BM2',
			},
		];
		slide.isDirty = true;
		const saved = await handler.save(data.slides);
		const xml = await slideXml(saved);

		// Exactly one timing tree per branch of exactly one envelope.
		expect(count(xml, '<p:timing>')).toBe(2);
		expect(count(xml, /<mc:AlternateContent/g)).toBe(1);
		const choice = xml.slice(xml.indexOf('<mc:Choice'), xml.indexOf('</mc:Choice>'));
		const fallback = xml.slice(xml.indexOf('<mc:Fallback'), xml.indexOf('</mc:Fallback>'));
		expect(choice).toContain('Requires="p14"');
		// BM1 (the deck's own) and BM2 (authored): start + next condition each.
		expect(count(choice, /<p14:bmkTgt spid="2" bmkName="BM1"/g)).toBe(2);
		expect(count(choice, /<p14:bmkTgt spid="2" bmkName="BM2"/g)).toBe(2);
		expect(choice).toContain('evt="onMediaBookmark"');
		expect(fallback).not.toContain('p14:');
		expect(fallback).not.toContain('onMediaBookmark');

		const reloaded = await load(saved);
		const reSlide = reloaded.data.slides[0]!;
		const reSecond = byName(reSlide.elements, 'Second Shape');
		const reClip = byName(reSlide.elements, 'Clip');
		expect(reSlide.animations?.[0]).toMatchObject({
			elementId: reSecond.id,
			trigger: 'onMediaBookmark',
			triggerShapeId: reClip.id,
			triggerBookmark: 'BM2',
		});
		const native = reSlide.nativeAnimations?.find((a) => a.targetId === reSecond.id);
		expect(native?.triggerBookmark).toBe('BM2');
	});

	it('moves an effect out of its bookmark sequence when the trigger changes back', async () => {
		const { handler, data } = await load(new Uint8Array(readFileSync(fixture)));
		const slide = data.slides[0]!;
		const second = byName(slide.elements, 'Second Shape');
		const clip = byName(slide.elements, 'Clip');
		slide.animations = [
			{
				elementId: second.id,
				entrance: 'fadeIn',
				trigger: 'onMediaBookmark',
				triggerShapeId: clip.id,
				triggerBookmark: 'BM2',
			},
		];
		slide.isDirty = true;
		const first = await load(await handler.save(data.slides));
		const reSlide = first.data.slides[0]!;
		reSlide.animations = reSlide.animations!.map((a) => ({ ...a, trigger: 'onClick' as const }));
		reSlide.isDirty = true;
		const xml = await slideXml(await first.handler.save(first.data.slides));
		expect(xml).not.toContain('bmkName="BM2"');
		// The deck's own BM1 trigger is untouched.
		expect(count(xml, /bmkName="BM1"/g)).toBe(2);
	});

	it('reads the bookmarks PowerPoint nests inside p14:media, and keeps one list on save', async () => {
		const { handler, data } = await load(new Uint8Array(readFileSync(fixture)));
		const clip = byName(data.slides[0]!.elements, 'Clip') as PptxElement & {
			bookmarks?: { label: string; time: number }[];
		};
		expect(clip.bookmarks?.map((b) => [b.label, b.time])).toStrictEqual([
			['BM1', 0.5],
			['BM2', 1.5],
		]);
		data.slides[0]!.isDirty = true;
		const xml = await slideXml(await handler.save(data.slides));
		expect(count(xml, /<p14:bmkLst>/g)).toBe(1);
		expect(xml).toMatch(/<p14:media[^>]*>\s*<p14:bmkLst>/);
	});

	it('keeps an untouched enveloped timing tree exactly once on a rewrite', async () => {
		const { handler, data } = await load(new Uint8Array(readFileSync(fixture)));
		data.slides[0]!.isDirty = true;
		const xml = await slideXml(await handler.save(data.slides));
		expect(count(xml, '<p:timing>')).toBe(2);
		expect(count(xml, /<mc:AlternateContent/g)).toBe(1);
		expect(count(xml, /bmkName="BM1"/g)).toBe(2);
	});
});
