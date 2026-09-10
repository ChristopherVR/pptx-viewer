/**
 * `a:hlinkClick` XML generation for a parsed `PptHyperlinkTarget`, the
 * OOXML-emission counterpart of `hyperlink-parser.ts`: the generated package
 * is loaded straight back through this project's normal PPTX pipeline (see
 * `package-writer.ts`'s doc comment), so this only needs to emit markup that
 * pipeline's own `a:hlinkClick` parser (`PptxHandlerRuntimeTableStylesAndActions.ts`
 * `parseAction`) already understands: an internal slide jump is recognised
 * from the relationship's OWN target file name (`slideN.xml`), not from any
 * number embedded in the `action` attribute.
 *
 * @module ppt/pptx/hyperlink-xml
 */

import type { PptHyperlinkTarget } from '../hyperlink-target';
import { esc } from './xml-utils';

/** Registers one relationship for the containing part, returning its `rId`. */
export interface HyperlinkRelAllocator {
	addRel(target: string, external: boolean, type?: string): string;
}

const SLIDE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide';

/**
 * Build the `<a:hlinkClick .../>` element for `target`, registering an
 * external or internal relationship via `alloc` when the kind needs one.
 * Returns `''` when `target` is `undefined` or (for a `slide` target) out of
 * range for `slideCount`.
 */
export function hyperlinkClickXml(
	target: PptHyperlinkTarget | undefined,
	alloc: HyperlinkRelAllocator,
	slideCount: number,
): string {
	if (!target) {
		return '';
	}
	const attrs: string[] = [];
	switch (target.kind) {
		case 'url':
			attrs.push(`r:id="${alloc.addRel(target.url, true)}"`);
			break;
		case 'slide': {
			if (target.slideIndex < 0 || target.slideIndex >= slideCount) {
				return '';
			}
			const relId = alloc.addRel(`slide${target.slideIndex + 1}.xml`, false, SLIDE_REL_TYPE);
			attrs.push(`r:id="${relId}"`, 'action="ppaction://hlinksldjump"');
			break;
		}
		case 'firstSlide':
			attrs.push('action="ppaction://hlinkshowjump?jump=firstslide"');
			break;
		case 'lastSlide':
			attrs.push('action="ppaction://hlinkshowjump?jump=lastslide"');
			break;
		case 'prevSlide':
			attrs.push('action="ppaction://hlinkshowjump?jump=previousslide"');
			break;
		case 'nextSlide':
			attrs.push('action="ppaction://hlinkshowjump?jump=nextslide"');
			break;
		case 'endShow':
			attrs.push('action="ppaction://hlinkshowjump?jump=endshow"');
			break;
		case 'lastViewed':
			attrs.push('action="ppaction://hlinkshowjump?jump=lastslideviewed"');
			break;
		case 'customShow':
			// No numeric custom-show id is recoverable from the binary format alone
			// (see `hyperlink-parser.ts`): the show's own NAME round-trips as the id.
			attrs.push(`action="ppaction://customshow?id=${esc(encodeURIComponent(target.name))}"`);
			break;
		case 'openFile':
			attrs.push(`r:id="${alloc.addRel(target.path, true)}"`, 'action="ppaction://hlinkfile"');
			break;
		case 'openPresentation':
			attrs.push(`r:id="${alloc.addRel(target.path, true)}"`, 'action="ppaction://hlinkpres"');
			break;
		default:
			return '';
	}
	return `<a:hlinkClick ${attrs.join(' ')}/>`;
}
