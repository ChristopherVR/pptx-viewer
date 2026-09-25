/**
 * An unedited animation list must not grow attributes on save.
 *
 * - `pptx:editorMeta/pptx:animations/pptx:animation@order`: the loader
 *   re-derives `order` from the live `p:timing` tree on every load, so an
 *   entry that stored no `@order` gained one on each rewrite
 *   (effect-sound-gallery.pptx, transitions-animations.pptx slide 3).
 * - `p:audio/p:cMediaNode/p:cTn@dur="indefinite"`: "play across slides" was
 *   already expressed by PowerPoint's own `cMediaNode@numSld`, and the media
 *   timing writer added the cTn form on top (issue-132-*.pptx slide 1).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../index';
import type { PptxElement, PptxSlide } from '../../index';

function fixture(name: string): string {
	return fileURLToPath(new URL(`../../../../../e2e/fixtures/${name}`, import.meta.url));
}

async function loadFixture(name: string): Promise<{ handler: PptxHandler; slides: PptxSlide[] }> {
	const bytes = readFileSync(fixture(name));
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return { handler, slides: data.slides };
}

async function savedPart(handler: PptxHandler, slides: PptxSlide[], part: string): Promise<string> {
	const saved = await handler.save(slides);
	return (await JSZip.loadAsync(saved)).file(part)!.async('string');
}

function editorMetaAnimations(xml: string): string[] {
	return xml.match(/<pptx:animation\b[^>]*>/g) ?? [];
}

describe('editorMeta @order is not invented on save', () => {
	it('omits @order for an unedited entry that stored none', async () => {
		const { handler, slides } = await loadFixture('effect-sound-gallery.pptx');
		expect(slides[0]!.animations?.[0]?.order).toBeTypeOf('number');
		slides[0]!.isDirty = true;
		const xml = await savedPart(handler, slides, 'ppt/slides/slide1.xml');
		const entries = editorMetaAnimations(xml);
		expect(entries).toHaveLength(1);
		expect(entries[0]).not.toContain('order=');
	});

	it('writes @order again once the order is actually changed', async () => {
		const { handler, slides } = await loadFixture('effect-sound-gallery.pptx');
		const slide = slides[0]!;
		const [animation] = slide.animations!;
		slide.animations = [{ ...animation!, order: (animation!.order ?? 0) + 3 }];
		slide.isDirty = true;
		const xml = await savedPart(handler, slides, 'ppt/slides/slide1.xml');
		expect(editorMetaAnimations(xml)[0]).toMatch(/order="\d+"/);
	});
});

function findMedia(elements: readonly PptxElement[]): PptxElement | undefined {
	for (const element of elements) {
		if (element.type === 'media') {
			return element;
		}
		if (element.type === 'group') {
			const nested = findMedia(element.children);
			if (nested) {
				return nested;
			}
		}
	}
	return undefined;
}

function audioNode(xml: string): string {
	return /<p:audio>[\s\S]*?<\/p:audio>/.exec(xml)?.[0] ?? '';
}

describe('play-across-slides audio keeps its authored storage form', () => {
	it('does not add cTn@dur when cMediaNode@numSld already says it', async () => {
		const { handler, slides } = await loadFixture('issue-132-gradient-fill.pptx');
		const media = findMedia(slides[0]!.elements);
		expect(media?.type === 'media' ? media.playAcrossSlides : undefined).toBeTruthy();
		slides[0]!.isDirty = true;
		const audio = audioNode(await savedPart(handler, slides, 'ppt/slides/slide1.xml'));
		expect(audio).toContain('numSld="999"');
		expect(audio).not.toMatch(/<p:cTn [^>]*dur=/);
	});

	it('drops the numSld span when play-across is switched off', async () => {
		const { handler, slides } = await loadFixture('issue-132-gradient-fill.pptx');
		const media = findMedia(slides[0]!.elements);
		if (media?.type !== 'media') {
			throw new Error('expected a media element on slide 1');
		}
		media.playAcrossSlides = false;
		slides[0]!.isDirty = true;
		const audio = audioNode(await savedPart(handler, slides, 'ppt/slides/slide1.xml'));
		expect(audio).not.toContain('numSld=');
		expect(audio).not.toMatch(/<p:cTn [^>]*dur="indefinite"/);
	});
});
