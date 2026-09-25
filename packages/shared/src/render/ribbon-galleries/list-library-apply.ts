/**
 * Bullet / Numbering Library picks as element patches, built on the ribbon's
 * own list machinery: `setElementBullets` turns the element's paragraphs into
 * a bulleted / numbered list exactly as the Bullets / Numbering buttons do
 * (markers, ordinals, paragraph metadata), and this module then gives each
 * marker the library's character + font or numbering scheme, keeping the
 * marker text in step with its `bulletInfo` so the renderer and writer agree.
 *
 * @module render/ribbon-galleries/list-library-apply
 */
import type { BulletInfo, PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { formatAutoNumber } from '../bullet-autonum';
import {
	elementBulletKind,
	isBulletMarkerSegment,
	resolveBulletSegments,
	setElementBullets,
	splitBulletParagraphs,
} from '../bullet-toggle';
import type { ElementBulletPatch } from '../bullet-toggle';
import type { BulletLibrarySpec } from './list-library-catalog';

type MarkerEdit = (info: BulletInfo) => BulletInfo;

/** A picture / inherited / other-kind marker definition the library pick replaces. */
function baseInfo(info: BulletInfo): BulletInfo {
	const next = { ...info };
	for (const key of [
		'none',
		'char',
		'autoNumType',
		'imageRelId',
		'imageDataUrl',
		'imageBlipFillXml',
		'fontInherit',
		'fontFamily',
		'fontPanose',
		'fontPitchFamily',
		'fontCharset',
	] as const) {
		delete next[key];
	}
	return next;
}

function markerText(info: BulletInfo, trailingSpace: boolean): string {
	if (info.autoNumType) {
		const n = Math.max(1, (info.autoNumStartAt ?? 1) + (info.paragraphIndex ?? 0));
		return `${formatAutoNumber(info.autoNumType, n)}${trailingSpace ? ' ' : ''}`;
	}
	return `${info.char ?? ''} `;
}

function remark(patch: ElementBulletPatch, edit: MarkerEdit): ElementBulletPatch {
	if (!patch.textSegments) {
		return patch;
	}
	const textSegments = patch.textSegments.map((segment): TextSegment => {
		if (!segment.bulletInfo || !isBulletMarkerSegment(segment)) {
			return segment;
		}
		const info = edit(segment.bulletInfo);
		return { ...segment, bulletInfo: info, text: markerText(info, segment.text.endsWith(' ')) };
	});
	return { ...patch, textSegments };
}

/** Bullet the whole element with `spec`'s character and font (`null` = None). */
export function applyBulletLibrary(
	element: PptxElement,
	spec: BulletLibrarySpec | null,
): ElementBulletPatch {
	if (!spec) {
		return setElementBullets(element, 'none');
	}
	return remark(setElementBullets(element, 'bullet'), (info) => ({
		...baseInfo(info),
		char: spec.char,
		fontFamily: spec.font.typeface,
		fontPanose: spec.font.panose,
		fontPitchFamily: spec.font.pitchFamily,
		fontCharset: spec.font.charset,
	}));
}

/** Number the whole element with `scheme` (`null` = None). */
export function applyNumberingLibrary(
	element: PptxElement,
	scheme: string | null,
): ElementBulletPatch {
	if (!scheme) {
		return setElementBullets(element, 'none');
	}
	return remark(setElementBullets(element, 'numbered'), (info) => ({
		...baseInfo(info),
		autoNumType: scheme,
		autoNumStartAt: info.autoNumStartAt ?? 1,
		paragraphIndex: info.paragraphIndex,
	}));
}

/** The first-segment `bulletInfo` of every non-empty paragraph. */
function paragraphInfos(element: PptxElement): Array<BulletInfo | undefined> {
	return splitBulletParagraphs(resolveBulletSegments(element))
		.filter((paragraph) => paragraph.segments.length > 0)
		.map((paragraph) => paragraph.segments[0].bulletInfo);
}

/** Whether every paragraph carries `spec`'s bullet (`null`: no paragraph has a list marker). */
export function hasBulletLibrary(element: PptxElement, spec: BulletLibrarySpec | null): boolean {
	if (!hasTextProperties(element)) {
		return false;
	}
	const kind = elementBulletKind(element);
	if (!spec) {
		return kind === 'none';
	}
	return (
		kind === 'bullet' &&
		paragraphInfos(element).every(
			(info) =>
				info?.char === spec.char &&
				(info.fontFamily ?? '').toLowerCase() === spec.font.typeface.toLowerCase(),
		)
	);
}

/** Whether every paragraph is numbered with `scheme` (`null`: no list markers). */
export function hasNumberingLibrary(element: PptxElement, scheme: string | null): boolean {
	if (!hasTextProperties(element)) {
		return false;
	}
	const kind = elementBulletKind(element);
	if (!scheme) {
		return kind === 'none';
	}
	return (
		kind === 'numbered' && paragraphInfos(element).every((info) => info?.autoNumType === scheme)
	);
}
