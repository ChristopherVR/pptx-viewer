/**
 * `PptxAction` -> `WHyperlinkKind` resolution for the `.ppt` writer.
 *
 * Reuses `pptxActionToElementAction` (the same OOXML `ppaction://` URI
 * parser the editor UI's Action Settings dialog uses) so the `.ppt` writer
 * never re-implements that parsing, then maps the resulting high-level
 * `ElementAction` onto the binary format's `WHyperlinkKind`.
 *
 * @module ppt/writer/hyperlink-model
 */

import type { PptxAction, PptxCustomShow, PptxSlide } from '../../types';
import { pptxActionToElementAction } from '../../utils/element-actions';
import type { WHyperlink, WHyperlinkKind } from './write-model';

/** Context needed to resolve a `customShow` action to a concrete target. */
export interface HyperlinkResolveContext {
	slides: PptxSlide[];
	customShows?: PptxCustomShow[];
}

/**
 * Resolve one custom show's first slide to its 1-based slide NUMBER (not its
 * `SlidePersistAtom.slideId`): confirmed against a COM-authored ground-truth
 * fixture that a custom-show `LocationAtom` is `"<firstSlideNumber>,0,<name>"`,
 * unlike a specific-slide jump's `"<slideId>,<slideNumber>,"` (see
 * `hyperlink-writer.ts#buildExHyperlinkContainer`). Falls back to slide 1
 * when the custom show's first `slideRIds` entry cannot be matched to a live
 * slide (e.g. that slide was since deleted).
 */
function resolveCustomShowFirstSlideNumber(show: PptxCustomShow, slides: PptxSlide[]): number {
	const firstRId = show.slideRIds[0];
	const index = firstRId ? slides.findIndex((s) => s.rId === firstRId) : -1;
	return index >= 0 ? index + 1 : 1;
}

/**
 * Resolve a parsed `PptxAction` (from `a:hlinkClick`, at either shape or
 * text-run level) to the binary `.ppt` writer's `WHyperlinkKind`, or
 * `undefined` when the action has no binary-`.ppt` hyperlink equivalent
 * (`playMedia`, `oleVerb`, `runProgram`, `none`: handled elsewhere, or not
 * expressible as a click-action hyperlink at all).
 */
export function resolveHyperlinkKind(
	pptxAction: PptxAction,
	ctx: HyperlinkResolveContext,
): WHyperlinkKind | undefined {
	const ea = pptxActionToElementAction(pptxAction, 'click');
	switch (ea.type) {
		case 'url':
			return ea.url ? { kind: 'url', url: ea.url } : undefined;
		case 'slide':
			return typeof ea.slideIndex === 'number'
				? { kind: 'slide', slideIndex: ea.slideIndex }
				: undefined;
		case 'firstSlide':
			return { kind: 'firstSlide' };
		case 'lastSlide':
			return { kind: 'lastSlide' };
		case 'prevSlide':
			return { kind: 'prevSlide' };
		case 'nextSlide':
			return { kind: 'nextSlide' };
		case 'endShow':
			return { kind: 'endShow' };
		case 'lastViewed':
			return { kind: 'lastViewed' };
		case 'customShow': {
			const show = ctx.customShows?.find((s) => s.id === ea.customShowId);
			if (!show) {
				return undefined;
			}
			return {
				kind: 'customShow',
				name: show.name,
				firstSlideIndex: resolveCustomShowFirstSlideNumber(show, ctx.slides) - 1,
				returnAfter: ea.returnAfter,
			};
		}
		case 'openFile':
			return ea.url ? { kind: 'openFile', path: ea.url } : undefined;
		case 'openPresentation':
			return ea.url ? { kind: 'openPresentation', path: ea.url } : undefined;
		default:
			// 'playMedia', 'oleVerb', 'runProgram', 'none': not a hyperlink target
			// this writer emits here (media/OLE actions ride along with their own
			// element type; a bare "no action" needs nothing written).
			return undefined;
	}
}

/** Resolve a parsed `PptxAction` to a full `WHyperlink` (target + tooltip). */
export function resolveHyperlink(
	pptxAction: PptxAction | undefined,
	ctx: HyperlinkResolveContext,
): WHyperlink | undefined {
	if (!pptxAction) {
		return undefined;
	}
	const target = resolveHyperlinkKind(pptxAction, ctx);
	return target ? { target, tooltip: pptxAction.tooltip } : undefined;
}
