import { EMU_PER_PX } from '../../constants';
import { XmlObject, PptxElement } from '../../types';
import { cloneXmlObject } from '../../utils/clone-utils';
import { scorePlaceholderMatch } from '../../utils/placeholder-remap';
import {
	createEmptyPlaceholderElement,
	retargetPlaceholder,
	setRawXmlTransform,
} from '../../utils/placeholder-xml';
import { xmlPath } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeTextEditing';
import type { PlaceholderInfo } from './PptxHandlerRuntimeTypes';

/** A placeholder slot offered by the layout being switched to. */
interface LayoutPlaceholderSlot {
	phInfo: PlaceholderInfo;
	xEmu: number;
	yEmu: number;
	cxEmu: number;
	cyEmu: number;
	shapeXml: XmlObject;
}

/**
 * Layout-switching helpers for the PptxHandlerRuntime mixin chain.
 *
 * Provides methods that map slide elements onto a new layout's placeholders,
 * reposition the matched ones, keep content the new layout has no slot for,
 * and inject empty placeholders that exist only in the target layout.
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	// ── Placeholder info extraction ─────────────────────────────────────

	/**
	 * Read placeholder info from a `p:nvPr` XML node.
	 *
	 * This is a local helper that mirrors the logic in
	 * `PptxHandlerRuntimeElementParsing.extractPlaceholderInfo` — we
	 * duplicate it here because that mixin sits higher in the chain and
	 * is not yet available at this level.
	 */
	private readPlaceholderInfoFromNvPr(nvPr: XmlObject | undefined): PlaceholderInfo | null {
		if (!nvPr) {
			return null;
		}
		const ph = nvPr['p:ph'] as XmlObject | undefined;
		if (!ph) {
			return null;
		}

		const idx = ph['@_idx'];
		const type = ph['@_type'];
		const sz = ph['@_sz'];

		return {
			idx: idx !== undefined ? String(idx) : undefined,
			type: type !== undefined ? String(type).toLowerCase() : undefined,
			sz: sz !== undefined ? String(sz).toLowerCase() : undefined,
		};
	}

	/**
	 * Extract placeholder info from a parsed slide element's rawXml.
	 * Works for shapes (`p:nvSpPr`), pictures (`p:nvPicPr`), and
	 * graphic frames (`p:nvGraphicFramePr`).
	 */
	protected getElementPlaceholderInfo(element: PptxElement): PlaceholderInfo | null {
		const raw = element.rawXml;
		if (!raw) {
			return null;
		}

		const nvPr =
			xmlPath(raw, 'p:nvSpPr', 'p:nvPr') ??
			xmlPath(raw, 'p:nvPicPr', 'p:nvPr') ??
			xmlPath(raw, 'p:nvGraphicFramePr', 'p:nvPr');

		return this.readPlaceholderInfoFromNvPr(nvPr);
	}

	// ── Layout placeholder extraction ───────────────────────────────────

	/**
	 * Extract all placeholders from a layout's `p:spTree`, returning
	 * their placeholder info and their transform (position/size in EMU).
	 */
	protected extractLayoutPlaceholders(layoutXml: XmlObject): LayoutPlaceholderSlot[] {
		const spTree = xmlPath(layoutXml, 'p:sldLayout', 'p:cSld', 'p:spTree');
		if (!spTree) {
			return [];
		}

		const result: LayoutPlaceholderSlot[] = [];

		// Placeholders are usually `p:sp`, but a layout may legitimately anchor
		// one on a picture or a graphic frame (PowerPoint writes those for
		// picture-with-caption layouts, and importers emit them freely). Scanning
		// shapes alone left those slots invisible to the remapper, so content
		// bound to them was treated as unmatched.
		const shapes = [
			...(this.ensureArray(spTree['p:sp']) as XmlObject[]),
			...(this.ensureArray(spTree['p:pic']) as XmlObject[]),
			...(this.ensureArray(spTree['p:graphicFrame']) as XmlObject[]),
		];
		for (const shape of shapes) {
			const nvPr =
				xmlPath(shape, 'p:nvSpPr', 'p:nvPr') ??
				xmlPath(shape, 'p:nvPicPr', 'p:nvPr') ??
				xmlPath(shape, 'p:nvGraphicFramePr', 'p:nvPr');
			const phInfo = this.readPlaceholderInfoFromNvPr(nvPr);
			if (!phInfo) {
				continue;
			}

			// Get transform
			const spPr = shape['p:spPr'] as XmlObject | undefined;
			const xfrm = spPr?.['a:xfrm'] as XmlObject | undefined;
			const off = xfrm?.['a:off'] as XmlObject | undefined;
			const ext = xfrm?.['a:ext'] as XmlObject | undefined;

			const xEmu = off ? Number(off['@_x'] || 0) : 0;
			const yEmu = off ? Number(off['@_y'] || 0) : 0;
			const cxEmu = ext ? Number(ext['@_cx'] || 0) : 0;
			const cyEmu = ext ? Number(ext['@_cy'] || 0) : 0;

			result.push({ phInfo, xEmu, yEmu, cxEmu, cyEmu, shapeXml: shape });
		}

		return result;
	}

	// ── Core layout switching logic ─────────────────────────────────────

	/**
	 * Re-map slide elements to a new layout's placeholders.
	 *
	 * - Placeholder elements are moved into the best-scoring free placeholder
	 *   of the new layout and adopt its position, size and `p:ph` identity.
	 * - Placeholder elements the new layout has no slot for are kept as
	 *   free-standing content, which is what PowerPoint does; discarding them
	 *   silently destroyed the user's text and pictures.
	 * - New-layout placeholders with no matching slide element produce
	 *   empty text elements that are appended to the slide.
	 * - Non-placeholder elements are left untouched.
	 *
	 * @returns The updated elements array.
	 */
	protected remapElementsToNewLayout(
		elements: PptxElement[],
		newLayoutXml: XmlObject,
		newLayoutPath: string,
	): PptxElement[] {
		// Keep the slots in an array rather than a map keyed by match key. A
		// layout may legally declare several placeholders of one family (two
		// content boxes, or a body whose idx is omitted alongside one that
		// carries it), and keying by family collapsed them onto a single entry,
		// so every slot but the last became unreachable.
		const targets: Array<LayoutPlaceholderSlot & { matched: boolean }> =
			this.extractLayoutPlaceholders(newLayoutXml).map((slot) => ({ ...slot, matched: false }));

		const resultElements: PptxElement[] = [];

		for (const element of elements) {
			const phInfo = this.getElementPlaceholderInfo(element);

			if (!phInfo) {
				// Non-placeholder element: keep as-is
				resultElements.push(element);
				continue;
			}

			// Rank every free slot instead of taking the first compatible one.
			// Layouts that mix content kinds need this: a picture must claim the
			// picture frame before the body box, or the deck's prose ends up in
			// the image slot and vice versa.
			let resolvedLayoutPh: (typeof targets)[number] | undefined;
			let bestScore = 0;
			for (const candidate of targets) {
				if (candidate.matched) {
					continue;
				}
				const score = scorePlaceholderMatch(element, phInfo, candidate.phInfo);
				if (score > bestScore) {
					bestScore = score;
					resolvedLayoutPh = candidate;
				}
			}

			if (resolvedLayoutPh) {
				// Matched: update position and size from new layout
				resolvedLayoutPh.matched = true;

				// Shallow-copying the element shares its rawXml with the pre-switch
				// model, so writing the new transform into it also rewrote history
				// entries and the caller's own copy. Clone before mutating.
				const updatedElement: PptxElement = {
					...element,
					rawXml: cloneXmlObject(element.rawXml),
				};
				if (resolvedLayoutPh.cxEmu > 0 && resolvedLayoutPh.cyEmu > 0) {
					updatedElement.x = Math.round(resolvedLayoutPh.xEmu / EMU_PER_PX);
					updatedElement.y = Math.round(resolvedLayoutPh.yEmu / EMU_PER_PX);
					updatedElement.width = Math.round(resolvedLayoutPh.cxEmu / EMU_PER_PX);
					updatedElement.height = Math.round(resolvedLayoutPh.cyEmu / EMU_PER_PX);
				}

				// Update the element's rawXml transform to match
				if (updatedElement.rawXml && resolvedLayoutPh.cxEmu > 0 && resolvedLayoutPh.cyEmu > 0) {
					setRawXmlTransform(
						updatedElement.rawXml,
						resolvedLayoutPh.xEmu,
						resolvedLayoutPh.yEmu,
						resolvedLayoutPh.cxEmu,
						resolvedLayoutPh.cyEmu,
					);
				}

				// The element now occupies a different slot, so its own `p:ph` has
				// to name that slot. Leaving the old type/idx behind meant the
				// saved deck claimed a placeholder the new layout does not define,
				// and inheritance resolved against the wrong entry on reload.
				if (updatedElement.rawXml) {
					retargetPlaceholder(updatedElement.rawXml, resolvedLayoutPh.phInfo);
				}

				resultElements.push(updatedElement);
			} else {
				// No slot for this content in the new layout. PowerPoint keeps it
				// on the slide as free-standing content rather than deleting it,
				// and so do we: dropping it silently lost the user's work.
				resultElements.push(element);
			}
		}

		// Add empty placeholders from the new layout that were not matched
		let slotIndex = 0;
		for (const lp of targets) {
			if (lp.matched) {
				continue;
			}
			// Skip footers, date-time, and slide number placeholders -- they
			// are rendered from the layout/master and don't need slide-level
			// elements.
			const skipTypes = new Set(['dt', 'ftr', 'sldnum', 'hdr']);
			if (lp.phInfo.type && skipTypes.has(lp.phInfo.type)) {
				continue;
			}

			// Create an empty text element for this placeholder
			const emptyElement = createEmptyPlaceholderElement(
				lp.phInfo,
				lp.xEmu,
				lp.yEmu,
				lp.cxEmu,
				lp.cyEmu,
				`${newLayoutPath}-${slotIndex++}-${Date.now()}`,
			);
			if (emptyElement) {
				resultElements.push(emptyElement);
			}
		}

		return resultElements;
	}
}
