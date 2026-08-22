import { XmlObject } from '../../types';
import type { PptxElementWithText, TextStyle } from '../../types';
import { writeBodyPrBooleanAttrs } from '../../utils/body-properties-parser';
import { applyTextBodyScene3d } from '../../utils/text-body-scene3d';
import {
	applyElementParagraphGeometryToListStyle,
	elementParagraphGeometryEdits,
	hasElementParagraphGeometry,
	withoutElementParagraphGeometry,
} from './element-paragraph-geometry';
import { preserveParagraphScopedState } from './paragraph-scoped-segment-state';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveEffectsWriter';
import { buildParagraphPropertiesXml } from './PptxHandlerRuntimeSaveParagraphHelpers';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Build and write the text body (`p:txBody`) for shapes, text boxes,
	 * and connectors that carry text content.
	 *
	 * Handles bodyPr attributes (vAlign, textDirection, columns, spacing,
	 * overflow, autoFit, body insets, text wrap, warp, 3D text, linked
	 * text chains), and delegates paragraph creation to
	 * `createParagraphsFromTextContent`.
	 */
	protected applyTextBodyContent(
		shape: XmlObject,
		el: PptxElementWithText,
		resolveHyperlinkRelationshipId: (target: string) => string | undefined,
		getSlideRelationshipMap: () => Map<string, string>,
	): void {
		const hasEditableTextContent =
			typeof el.text === 'string' || (el.textSegments?.length ?? 0) > 0;
		if (!hasEditableTextContent) {
			return;
		}

		// A footer / header / date / slide-number placeholder whose text the loader
		// INHERITED from the slide master must go back out the way PowerPoint
		// writes it: an empty body on the slide, so the string keeps coming from
		// the master and the Header & Footer dialog keeps owning it. Re-emitting
		// the resolved string would pin this slide to the text the master happened
		// to hold at load. An edit changes `el.text`, so the equality check still
		// lets a genuine per-slide override through to the writer below.
		if (
			el.inheritedPlaceholderText !== undefined &&
			el.text === el.inheritedPlaceholderText &&
			el.rawXml !== undefined
		) {
			return;
		}

		if (!shape['p:txBody']) {
			shape['p:txBody'] = {
				'a:bodyPr': {},
				'a:lstStyle': {},
				'a:p': [],
			};
		}
		const txBody = shape['p:txBody'] as XmlObject;
		const bodyPr = (txBody['a:bodyPr'] || {}) as XmlObject;

		// Vertical anchor
		const verticalAnchor = this.textVerticalAlignToDrawingValue(el.textStyle?.vAlign);
		if (verticalAnchor) {
			bodyPr['@_anchor'] = verticalAnchor;
		} else {
			delete bodyPr['@_anchor'];
		}

		// Text direction
		const bodyTextDirection = this.textDirectionToDrawingValue(el.textStyle?.textDirection);
		if (bodyTextDirection) {
			bodyPr['@_vert'] = bodyTextDirection;
		} else {
			delete bodyPr['@_vert'];
		}

		// Column count
		const bodyColumnCount = this.normalizeTextColumnCount(el.textStyle?.columnCount);
		if (bodyColumnCount && bodyColumnCount > 1) {
			bodyPr['@_numCol'] = String(bodyColumnCount);
		} else {
			delete bodyPr['@_numCol'];
		}

		// Column spacing
		if (el.textStyle?.columnSpacing !== undefined) {
			bodyPr['@_spcCol'] = String(
				Math.round(el.textStyle.columnSpacing * PptxHandlerRuntime.EMU_PER_PX),
			);
		}

		// Overflow
		if (el.textStyle?.hOverflow) {
			bodyPr['@_horzOverflow'] = el.textStyle.hOverflow;
			delete bodyPr['@_hOverflow'];
		}
		if (el.textStyle?.vertOverflow) {
			bodyPr['@_vertOverflow'] = el.textStyle.vertOverflow;
		}

		// Auto-fit / shrink-to-fit
		this.applyAutoFitToBodyPr(bodyPr, el);

		// Body text insets
		this.applyBodyInsets(bodyPr, el);

		// Text wrapping mode
		if (el.textStyle?.textWrap === 'none') {
			bodyPr['@_wrap'] = 'none';
		} else if (el.textStyle?.textWrap === 'square') {
			bodyPr['@_wrap'] = 'square';
		}

		// Additional bodyPr boolean attributes
		writeBodyPrBooleanAttrs(bodyPr, el.textStyle);

		// Text warp preset
		if (el.textStyle?.textWarpPreset) {
			const prstTxWarpNode: XmlObject = {
				'@_prst': el.textStyle.textWarpPreset,
			};
			// Round-trip adjustment values (adj / adj2)
			const adjGds: XmlObject[] = [];
			if (el.textStyle.textWarpAdj !== undefined && Number.isFinite(el.textStyle.textWarpAdj)) {
				adjGds.push({
					'@_name': 'adj',
					'@_fmla': `val ${el.textStyle.textWarpAdj}`,
				});
			}
			if (el.textStyle.textWarpAdj2 !== undefined && Number.isFinite(el.textStyle.textWarpAdj2)) {
				adjGds.push({
					'@_name': 'adj2',
					'@_fmla': `val ${el.textStyle.textWarpAdj2}`,
				});
			}
			if (adjGds.length > 0) {
				prstTxWarpNode['a:avLst'] = { 'a:gd': adjGds.length === 1 ? adjGds[0] : adjGds };
			}
			bodyPr['a:prstTxWarp'] = prstTxWarpNode;
		} else {
			delete bodyPr['a:prstTxWarp'];
		}

		applyTextBodyScene3d(bodyPr, el.textStyle);
		// 3D text body
		this.applyText3d(bodyPr, el);

		// Linked text box chain round-trip
		if (el.linkedTxbxId !== undefined && Number.isFinite(el.linkedTxbxId)) {
			bodyPr['a:linkedTxbx'] = {
				'@_id': String(el.linkedTxbxId),
				'@_seq': String(el.linkedTxbxSeq ?? 0),
			};
		} else {
			delete bodyPr['a:linkedTxbx'];
		}

		// Resolve text value and segments
		const textValueForSave = this.getTextValueForSave(el.text, el.textSegments);
		let textSegmentsForSave = el.textSegments;
		if (typeof el.text === 'string' && this.areTextSegmentsUniform(el.textSegments)) {
			textSegmentsForSave = undefined;
			const existingTextSegments = this.extractTextSegmentsFromTxBodyForRewrite(
				txBody,
				el.textStyle,
				getSlideRelationshipMap(),
			);
			if (existingTextSegments.length > 1 && this.hasMixedTextStyles(existingTextSegments)) {
				textSegmentsForSave = this.remapEditedTextToExistingStyles(
					existingTextSegments,
					textValueForSave,
					el.textStyle,
				);
			}
			// "Uniform" is a RUN-scope judgement (every `a:rPr` would come out
			// the same), so collapsing the runs is legitimate. The paragraph
			// scope is not its to discard: `a:pPr` geometry, the outline level,
			// the bullet and `a:endParaRPr` all ride on the first segment of
			// each paragraph, and the segmentless path supplies none of them, so
			// dropping the list flattened every authored `a:pPr` to `<a:pPr/>`.
			textSegmentsForSave = preserveParagraphScopedState(
				textSegmentsForSave,
				textValueForSave,
				el.textSegments,
			);
		}

		txBody['a:bodyPr'] = bodyPr;
		txBody['a:p'] = this.createParagraphsFromTextContent(
			textValueForSave,
			this.routeElementParagraphGeometry(txBody, el.textStyle),
			textSegmentsForSave,
			resolveHyperlinkRelationshipId,
		);
	}

	/**
	 * Move the element-scope paragraph geometry out of every `a:pPr` and into
	 * the text body's `a:lstStyle > a:lvl1pPr`, returning the element style with
	 * that geometry removed so the paragraph writer no longer broadcasts it.
	 *
	 * See `element-paragraph-geometry.ts` for why the `a:lstStyle` slot is the
	 * one that makes the "authored versus resolved" question answerable at all.
	 */
	private routeElementParagraphGeometry(
		txBody: XmlObject,
		textStyle: TextStyle | undefined,
	): TextStyle | undefined {
		const edits = elementParagraphGeometryEdits(textStyle);
		if (edits === undefined) {
			// No load-time snapshot: this text was not parsed from a deck, so the
			// element style is its only description and the paragraph writer must
			// keep writing it out. Nothing changes for SDK-built decks.
			return textStyle;
		}
		if (hasElementParagraphGeometry(edits)) {
			applyElementParagraphGeometryToListStyle(
				txBody,
				buildParagraphPropertiesXml(edits, this.textAlignToDrawingValue(edits.align), undefined, {
					spacingBefore: this.createParagraphSpacingXmlFromPx(edits.paragraphSpacingBefore),
					spacingAfter: this.createParagraphSpacingXmlFromPx(edits.paragraphSpacingAfter),
					lineSpacing: this.createLineSpacingXmlFromMultiplier(edits.lineSpacing),
					lineSpacingExactPt: edits.lineSpacingExactPt,
				}),
			);
		}
		// Everything else the element style says about paragraphs came out of the
		// cascade, so it is dropped rather than stamped onto every `a:pPr`: the
		// paragraphs that authored geometry still emit their own, and the rest go
		// back to inheriting it.
		return withoutElementParagraphGeometry(textStyle);
	}

	/** Apply auto-fit mode settings to bodyPr. */
	private applyAutoFitToBodyPr(bodyPr: XmlObject, el: PptxElementWithText): void {
		if (el.textStyle?.autoFitMode !== undefined) {
			delete bodyPr['a:spAutoFit'];
			delete bodyPr['a:normAutofit'];
			delete bodyPr['a:noAutofit'];

			if (el.textStyle.autoFitMode === 'shrink') {
				bodyPr['a:spAutoFit'] = {};
			} else if (el.textStyle.autoFitMode === 'normal') {
				const normNode: XmlObject = {};
				if (el.textStyle.autoFitFontScale !== undefined && el.textStyle.autoFitFontScale < 1) {
					normNode['@_fontScale'] = String(Math.round(el.textStyle.autoFitFontScale * 100000));
				}
				if (
					el.textStyle.autoFitLineSpacingReduction !== undefined &&
					el.textStyle.autoFitLineSpacingReduction > 0
				) {
					normNode['@_lnSpcReduction'] = String(
						Math.round(el.textStyle.autoFitLineSpacingReduction * 100000),
					);
				}
				bodyPr['a:normAutofit'] = normNode;
			} else if (el.textStyle.autoFitMode === 'none') {
				bodyPr['a:noAutofit'] = {};
			}
		} else if (el.textStyle?.autoFit) {
			// Legacy path — keep backward compat
			if (!bodyPr['a:spAutoFit'] && !bodyPr['a:normAutofit']) {
				if (el.textStyle.autoFitFontScale !== undefined && el.textStyle.autoFitFontScale < 1) {
					const normNode: XmlObject = {
						'@_fontScale': String(Math.round(el.textStyle.autoFitFontScale * 100000)),
					};
					if (
						el.textStyle.autoFitLineSpacingReduction !== undefined &&
						el.textStyle.autoFitLineSpacingReduction > 0
					) {
						normNode['@_lnSpcReduction'] = String(
							Math.round(el.textStyle.autoFitLineSpacingReduction * 100000),
						);
					}
					bodyPr['a:normAutofit'] = normNode;
				} else {
					bodyPr['a:spAutoFit'] = {};
				}
			}
			if (bodyPr['a:normAutofit'] && el.textStyle.autoFitFontScale !== undefined) {
				(bodyPr['a:normAutofit'] as XmlObject)['@_fontScale'] = String(
					Math.round(el.textStyle.autoFitFontScale * 100000),
				);
			}
		} else if (el.textStyle?.autoFit === false && el.textStyle?.autoFitMode === undefined) {
			delete bodyPr['a:spAutoFit'];
			delete bodyPr['a:normAutofit'];
		}
	}

	/** Apply body insets (margin) to bodyPr. */
	private applyBodyInsets(bodyPr: XmlObject, el: PptxElementWithText): void {
		if (
			typeof el.textStyle?.bodyInsetLeft === 'number' &&
			Number.isFinite(el.textStyle.bodyInsetLeft)
		) {
			bodyPr['@_lIns'] = String(
				Math.round(el.textStyle.bodyInsetLeft * PptxHandlerRuntime.EMU_PER_PX),
			);
		}
		if (
			typeof el.textStyle?.bodyInsetTop === 'number' &&
			Number.isFinite(el.textStyle.bodyInsetTop)
		) {
			bodyPr['@_tIns'] = String(
				Math.round(el.textStyle.bodyInsetTop * PptxHandlerRuntime.EMU_PER_PX),
			);
		}
		if (
			typeof el.textStyle?.bodyInsetRight === 'number' &&
			Number.isFinite(el.textStyle.bodyInsetRight)
		) {
			bodyPr['@_rIns'] = String(
				Math.round(el.textStyle.bodyInsetRight * PptxHandlerRuntime.EMU_PER_PX),
			);
		}
		if (
			typeof el.textStyle?.bodyInsetBottom === 'number' &&
			Number.isFinite(el.textStyle.bodyInsetBottom)
		) {
			bodyPr['@_bIns'] = String(
				Math.round(el.textStyle.bodyInsetBottom * PptxHandlerRuntime.EMU_PER_PX),
			);
		}
	}

	/** Apply 3D text properties to bodyPr. */
	private applyText3d(bodyPr: XmlObject, el: PptxElementWithText): void {
		// `a:sp3d` / `a:flatTx` are a mutually exclusive choice (`EG_Text3D`):
		// an explicit "render flat" override never coexists with extrusion/bevel
		// data, so it is written instead of (never alongside) `a:sp3d`.
		if (el.textStyle?.flatText) {
			bodyPr['a:flatTx'] = {};
			delete bodyPr['a:sp3d'];
			return;
		}
		delete bodyPr['a:flatTx'];
		const t3d = el.textStyle?.text3d;
		if (t3d && Object.keys(t3d).length > 0) {
			const sp3dXml: XmlObject = {};
			if (t3d.extrusionHeight) {
				sp3dXml['@_extrusionH'] = String(t3d.extrusionHeight);
			}
			if (t3d.presetMaterial) {
				sp3dXml['@_prstMaterial'] = t3d.presetMaterial;
			}
			if (t3d.bevelTopType && t3d.bevelTopType !== 'none') {
				const bvt: XmlObject = { '@_prst': t3d.bevelTopType };
				if (t3d.bevelTopWidth) {
					bvt['@_w'] = String(t3d.bevelTopWidth);
				}
				if (t3d.bevelTopHeight) {
					bvt['@_h'] = String(t3d.bevelTopHeight);
				}
				sp3dXml['a:bevelT'] = bvt;
			}
			if (t3d.bevelBottomType && t3d.bevelBottomType !== 'none') {
				const bvb: XmlObject = { '@_prst': t3d.bevelBottomType };
				if (t3d.bevelBottomWidth) {
					bvb['@_w'] = String(t3d.bevelBottomWidth);
				}
				if (t3d.bevelBottomHeight) {
					bvb['@_h'] = String(t3d.bevelBottomHeight);
				}
				sp3dXml['a:bevelB'] = bvb;
			}
			if (t3d.extrusionColor) {
				sp3dXml['a:extrusionClr'] = {
					'a:srgbClr': {
						'@_val': t3d.extrusionColor.replace('#', ''),
					},
				};
			}
			bodyPr['a:sp3d'] = sp3dXml;
		} else {
			delete bodyPr['a:sp3d'];
		}
	}
}
