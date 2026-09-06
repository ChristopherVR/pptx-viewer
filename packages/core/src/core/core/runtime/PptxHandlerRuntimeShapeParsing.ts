import { PptxElement, XmlObject, TextSegment, TextStyle } from '../../types';
import { isCNvPrMarkedDecorative } from '../../utils/decorative-extension';
import {
	inheritedPlaceholderFieldType,
	isHeaderFooterPlaceholder,
} from '../../utils/header-footer-placeholder';
import { textBodyHasContent } from '../../utils/text-body-has-content';
import { xmlAttr, xmlChild, xmlPath } from '../../utils/xml-access';
import { createAutoNumberSequence } from './auto-number-sequence';
import { captureResolvedParagraphGeometry } from './element-paragraph-geometry';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeShapeParagraphContentParsing';
import type { ShapeTextParsingContext } from './PptxHandlerRuntimeTypes';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected parseShape(shape: XmlObject, id: string, slidePath?: string): PptxElement | null {
		try {
			const spPr = shape['p:spPr'] as XmlObject | undefined;
			const slideRelationshipMap = slidePath ? this.slideRelsMap.get(slidePath) : undefined;
			const placeholderInfo = this.extractPlaceholderInfo(
				(shape?.['p:nvSpPr'] as XmlObject | undefined)?.['p:nvPr'] as XmlObject | undefined,
			);
			const inheritedPlaceholder =
				slidePath && placeholderInfo
					? this.findPlaceholderContext(slidePath, placeholderInfo)
					: undefined;
			const inheritedSpPr = (inheritedPlaceholder?.shape?.['p:spPr'] ||
				inheritedPlaceholder?.picture?.['p:spPr']) as XmlObject | undefined;
			// A slide placeholder inherits its transform from the layout/master,
			// but does not automatically render the ancestor's fill or line. Those
			// visual properties belong to the layout/master placeholder itself.
			const effectiveSpPr = spPr
				? {
						...spPr,
						'a:xfrm': this.mergeXmlObjects(
							inheritedSpPr?.['a:xfrm'] as XmlObject | undefined,
							spPr['a:xfrm'] as XmlObject | undefined,
						),
					}
				: inheritedSpPr;
			const xfrm = (effectiveSpPr?.['a:xfrm'] || spPr?.['a:xfrm'] || inheritedSpPr?.['a:xfrm']) as
				| XmlObject
				| undefined;

			const off = xmlChild(xfrm, 'a:off');
			const ext = xmlChild(xfrm, 'a:ext');

			// A shape whose transform cannot be resolved is normally an empty stub
			// and is skipped. It must NEVER be skipped when it carries typed text:
			// dropping it here keeps it out of the model, so the save pipeline has
			// nothing to re-emit and the user's text is gone from the file with no
			// warning. Degrade to a zero transform instead, so the content survives
			// the round trip.
			if ((!xfrm || !off || !ext) && !textBodyHasContent(shape['p:txBody'])) {
				return null;
			}

			// Exact EMU alongside the rounded pixel value, for `resolveXfrmEmu`
			// (xfrm-emu-resolution.ts) to re-emit byte-identical `a:off`/`a:ext`
			// on save when this shape has not moved/resized. `off`/`ext` here
			// are the EFFECTIVE (placeholder-merged) transform, but the save
			// writer only ever patches THIS shape's own `a:xfrm` (a no-op when
			// it has none), so a value inherited from a layout/master is
			// harmless to record: it is never written unless the slide shape
			// already carries its own `a:xfrm` to patch.
			const xEmu = parseInt(xmlAttr(off, 'x') || '0');
			const yEmu = parseInt(xmlAttr(off, 'y') || '0');
			const widthEmu = parseInt(xmlAttr(ext, 'cx') || '0');
			const heightEmu = parseInt(xmlAttr(ext, 'cy') || '0');
			const x = Math.round(xEmu / PptxHandlerRuntime.EMU_PER_PX);
			const y = Math.round(yEmu / PptxHandlerRuntime.EMU_PER_PX);
			const width = Math.round(widthEmu / PptxHandlerRuntime.EMU_PER_PX);
			const height = Math.round(heightEmu / PptxHandlerRuntime.EMU_PER_PX);

			const rotation = xfrm?.['@_rot'] ? parseInt(String(xfrm['@_rot']), 10) / 60000 : undefined;
			const skewX = xfrm?.['@_skewX'] ? parseInt(String(xfrm['@_skewX']), 10) / 60000 : undefined;
			const skewY = xfrm?.['@_skewY'] ? parseInt(String(xfrm['@_skewY']), 10) / 60000 : undefined;
			const { flipHorizontal, flipVertical } = this.readFlipState(xfrm);

			// Extract shape geometry
			const prstGeom = xmlAttr(xmlChild(effectiveSpPr, 'a:prstGeom'), 'prst');
			const shapeAdjustments = this.parseGeometryAdjustments(
				effectiveSpPr?.['a:prstGeom'] as XmlObject | undefined,
			);
			let shapeType = prstGeom || 'rect';
			let pathData: string | undefined;
			let pathWidth: number | undefined;
			let pathHeight: number | undefined;
			let customGeometryRawData: ReturnType<typeof this.extractCustomGeometryRawData>;
			let customGeometryAdjustHandlesXY: ReturnType<
				typeof this.extractCustomGeometryAdjustHandles
			>['xy'];
			let customGeometryAdjustHandlesPolar: ReturnType<
				typeof this.extractCustomGeometryAdjustHandles
			>['polar'];
			let customGeometryConnectionSites: ReturnType<
				typeof this.extractCustomGeometryConnectionSites
			>;
			let customGeometryTextRect: ReturnType<typeof this.extractCustomGeometryTextRect>;
			let customGeometryPaths: ReturnType<typeof this.buildStructuredCustomGeometryPaths>;

			const custGeom = effectiveSpPr?.['a:custGeom'];
			if (custGeom) {
				const customPath = this.parseCustomGeometry(
					custGeom as XmlObject | undefined,
					width,
					height,
				);
				if (customPath) {
					shapeType = 'custom';
					pathData = customPath.pathData;
					pathWidth = customPath.pathWidth;
					pathHeight = customPath.pathHeight;
					customGeometryPaths = this.buildStructuredCustomGeometryPaths(
						custGeom as XmlObject,
						customPath.pathWidth,
						customPath.pathHeight,
					);
					customGeometryRawData = this.extractCustomGeometryRawData(custGeom as XmlObject);
					const typedHandles = this.extractCustomGeometryAdjustHandles(custGeom as XmlObject);
					customGeometryAdjustHandlesXY = typedHandles.xy;
					customGeometryAdjustHandlesPolar = typedHandles.polar;
					customGeometryConnectionSites = this.extractCustomGeometryConnectionSites(
						custGeom as XmlObject,
					);
					customGeometryTextRect = this.extractCustomGeometryTextRect(custGeom as XmlObject);
				}
			}

			const geomNode =
				(custGeom as XmlObject | undefined) ??
				(effectiveSpPr?.['a:prstGeom'] as XmlObject | undefined);
			const adjustmentHandles = this.parseAdjustmentHandles(
				geomNode,
				width,
				height,
				shapeAdjustments,
			);

			// ── Text body ────────────────────────────────────────────
			const ownTxBody = shape['p:txBody'] as XmlObject | undefined;
			const inheritedTxBody = inheritedPlaceholder?.shape?.['p:txBody'] as XmlObject | undefined;
			// PowerPoint keeps the footer / header / date / slide-number STRING on
			// the slide master and writes each slide's copy of the placeholder with
			// an EMPTY body so it inherits (verified through COM, see
			// `header-footer-parts.ts`). That empty body is an instruction to render
			// the master's string here, not an empty footer, so it must not win over
			// the ancestor's. Restricted to those four types on purpose: an empty
			// `title` / `body` placeholder inherits PROMPT text ("Click to edit
			// Master title style"), which is chrome and must never render as content.
			const inheritsPlaceholderText =
				isHeaderFooterPlaceholder(placeholderInfo?.type) &&
				!textBodyHasContent(ownTxBody) &&
				textBodyHasContent(inheritedTxBody);
			const txBody = inheritsPlaceholderText ? inheritedTxBody : ownTxBody || inheritedTxBody;
			this.compatibilityService.inspectShapeCompatibility(
				effectiveSpPr,
				txBody as XmlObject | undefined,
				slidePath,
				id,
			);
			const styleNode = (shape['p:style'] ||
				inheritedPlaceholder?.shape?.['p:style'] ||
				inheritedPlaceholder?.picture?.['p:style']) as XmlObject | undefined;

			let text = '';
			const textStyle: TextStyle = {};
			const textSegments: TextSegment[] = [];
			const paragraphIndents: Array<{ marginLeft?: number; indent?: number }> = [];
			const inheritedBodyDefaultRunStyle = this.extractTextRunStyle(
				xmlPath(inheritedTxBody, 'a:lstStyle', 'a:defPPr', 'a:defRPr'),
				'left',
				slideRelationshipMap,
				false,
			);
			const bodyDefaultRunStyle = {
				...inheritedBodyDefaultRunStyle,
				...this.extractTextRunStyle(
					xmlPath(txBody as XmlObject | undefined, 'a:lstStyle', 'a:defPPr', 'a:defRPr'),
					'left',
					slideRelationshipMap,
					false,
				),
			} as TextStyle;
			Object.assign(textStyle, bodyDefaultRunStyle);

			const fontRef = styleNode?.['a:fontRef'] as XmlObject | undefined;
			const fontRefIdx = String(fontRef?.['@_idx'] || '').toLowerCase();
			const styleFontRefTypeface =
				fontRefIdx.length > 0
					? this.resolveThemeTypeface(fontRefIdx.includes('minor') ? '+mn-lt' : '+mj-lt')
					: undefined;
			const styleFontRefColor = fontRef ? this.parseColor(fontRef) : undefined;
			if (!textStyle.fontFamily && styleFontRefTypeface) {
				textStyle.fontFamily = styleFontRefTypeface;
			}
			if (!textStyle.color) {
				textStyle.color = styleFontRefColor;
			}

			const bodyPr = ((txBody as XmlObject | undefined)?.['a:bodyPr'] ||
				(inheritedTxBody as XmlObject | undefined)?.['a:bodyPr']) as XmlObject | undefined;
			const bodyPropResult = this.applyBodyProperties(
				bodyPr,
				txBody as XmlObject | undefined,
				textStyle,
			);
			const linkedTxbxId = bodyPropResult.linkedTxbxId;
			const linkedTxbxSeq = bodyPropResult.linkedTxbxSeq;

			// Placeholder defaults
			const phDefaults =
				slidePath && placeholderInfo
					? this.lookupPlaceholderDefaults(slidePath, placeholderInfo)
					: undefined;
			if (phDefaults) {
				this.applyPlaceholderBodyDefaults(textStyle, phDefaults);
			}
			if (this.presentationDefaultTextStyle) {
				this.applyPlaceholderBodyDefaults(textStyle, this.presentationDefaultTextStyle);
			}

			const txBodyObj = txBody as XmlObject | undefined;
			if (txBodyObj?.['a:p']) {
				const paras = this.ensureArray(txBodyObj['a:p']) as XmlObject[];
				const textParts: string[] = [];
				let didSeedPrimaryTextStyle = false;
				const effectiveLevelStyles =
					phDefaults?.levelStyles ?? this.presentationDefaultTextStyle?.levelStyles;
				const ctx: ShapeTextParsingContext = {
					txBody: txBodyObj,
					inheritedTxBody,
					bodyDefaultRunStyle,
					slideRelationshipMap,
					placeholderInfo: placeholderInfo ?? undefined,
					phDefaults,
					slidePath,
					effectiveLevelStyles,
					styleFontRefColor,
					styleFontRefTypeface,
					autoNumbering: createAutoNumberSequence(),
				};

				paras.forEach((p: XmlObject, pIdx: number) => {
					const styleResult = this.resolveShapeParagraphStyle(p, textStyle, ctx);
					paragraphIndents.push(styleResult.indent);

					const contentResult = this.collectShapeParagraphContent(
						p,
						pIdx,
						paras.length,
						styleResult.paraAlign,
						styleResult.mergedDefaultRunStyle,
						ctx,
					);
					textParts.push(...contentResult.parts);
					textSegments.push(...contentResult.segments);
					if (contentResult.seedStyle && !didSeedPrimaryTextStyle) {
						Object.assign(textStyle, contentResult.seedStyle);
						didSeedPrimaryTextStyle = true;
					}
				});
				text = textParts.join('');
				// The element-scope paragraph geometry above is RESOLVED: it comes
				// from the shape's `a:lstStyle`, the layout placeholder, the master
				// and the first paragraph's own `a:pPr`, first-wins. Recording it
				// here is what later lets the writer tell an inherited value (leave
				// it out, so the deck stays layout-driven) from one the user has
				// since edited (write it, once, into `a:lstStyle/a:lvl1pPr`). The
				// element-level text panels patch `element.textStyle` and nothing
				// else, so without this snapshot the two are indistinguishable.
				captureResolvedParagraphGeometry(textStyle);
			}

			// A footer / header string inherited from the master is a LIVE value:
			// the Header & Footer dialog owns it, so tagging the inherited runs as
			// field runs lets the shared field substitution resolve them from
			// `PptxHeaderFooter` and repaint every binding's canvas the moment the
			// dialog changes, instead of freezing the string captured at load.
			// `dt` / `sldNum` masters carry a real `a:fld`, which already parsed
			// with its own type, so `inheritedPlaceholderFieldType` skips them.
			const inheritedFieldType = inheritsPlaceholderText
				? inheritedPlaceholderFieldType(placeholderInfo?.type)
				: undefined;
			if (inheritedFieldType) {
				for (const segment of textSegments) {
					if (segment.fieldType === undefined && segment.text.length > 0) {
						segment.fieldType = inheritedFieldType;
					}
				}
			}

			// Extract shape style + determine element type
			const shapeStyle = this.extractShapeStyle(effectiveSpPr, styleNode);
			// `<p:sp useBgFill="1">` paints the slide background instead of the
			// shape's own fill. PowerPoint's designer full-bleed panels carry it
			// ALONGSIDE an `a:fillRef` to accent1, so honouring only the style ref
			// painted a white background panel in the accent colour. The resolved
			// background is stamped on later, once the slide's own is known.
			const useBgFill = String(shape?.['@_useBgFill'] ?? '')
				.trim()
				.toLowerCase();
			if (useBgFill === '1' || useBgFill === 'true') {
				shapeStyle.useBackgroundFill = true;
			}
			const hasText = text.trim().length > 0;
			const isPlainRect = (!prstGeom || prstGeom === 'rect') && !custGeom;
			const hasVisibleStyle =
				(shapeStyle.fillColor && shapeStyle.fillColor !== 'transparent') ||
				(shapeStyle.strokeWidth || 0) > 0;

			let type: PptxElement['type'] = 'shape';
			if (hasText && isPlainRect && !hasVisibleStyle) {
				type = 'text';
			}

			// Parse shape-level actions (hyperlinks, slide jumps)
			const cNvPrForActions = (shape?.['p:nvSpPr'] as XmlObject | undefined)?.['p:cNvPr'] as
				| XmlObject
				| undefined;
			const { actionClick, actionHover } = this.parseElementActions(
				cNvPrForActions,
				slideRelationshipMap,
				this.orderedSlidePaths,
			);

			// Extract element name from cNvPr/@name (used for morph !! matching)
			const elementName = cNvPrForActions?.['@_name']
				? String(cNvPrForActions['@_name']).trim()
				: undefined;

			// Accessibility description/title from `p:cNvPr/@descr` / `@title` --
			// the same attributes a picture's alt text (descr only) and a graphic
			// frame's altText/title come from (see `PptxGraphicFrameParser.ts`).
			// A plain shape / text box had neither parsed, so PowerPoint's
			// Accessibility pane text for one was silently dropped on load.
			const shapeAltText = String(cNvPrForActions?.['@_descr'] || '').trim() || undefined;
			const shapeTitle = String(cNvPrForActions?.['@_title'] || '').trim() || undefined;

			// Parse shape lock attributes with inheritance
			const cNvSpPr = (shape?.['p:nvSpPr'] as XmlObject | undefined)?.['p:cNvSpPr'] as
				| XmlObject
				| undefined;
			const spLocksNode = cNvSpPr?.['a:spLocks'] as XmlObject | undefined;
			const slideLocks = this.parseShapeLocks(spLocksNode);
			const inheritedCNvSpPr =
				xmlPath(inheritedPlaceholder?.shape, 'p:nvSpPr', 'p:cNvSpPr') ??
				xmlPath(inheritedPlaceholder?.picture, 'p:nvPicPr', 'p:cNvPicPr');
			const inheritedLockNode = (inheritedCNvSpPr?.['a:spLocks'] ??
				inheritedCNvSpPr?.['a:picLocks']) as XmlObject | undefined;
			const inheritedLocks = this.parseShapeLocks(inheritedLockNode);
			let locks = inheritedLocks ? { ...inheritedLocks, ...slideLocks } : slideLocks;
			// `@txBox` lives on `p:cNvSpPr` (not inside `a:spLocks`); fold it into
			// the same `locks` bag so it round-trips through the model.
			const txBox = this.parseTxBoxFlag(cNvSpPr);
			if (txBox !== undefined) {
				locks = { ...(locks ?? {}), txBox };
			}

			const promptText = !hasText && phDefaults?.promptText ? phDefaults.promptText : undefined;

			const opaqueExtLstXml = this.extractOpaqueSpPrExtLst(effectiveSpPr);

			// "Mark as decorative" (`adec:decorative` on `p:cNvPr/a:extLst`).
			const isDecorative = isCNvPrMarkedDecorative(cNvPrForActions);

			const commonProps = {
				id,
				name: elementName || undefined,
				altText: shapeAltText,
				title: shapeTitle,
				...(isDecorative !== undefined ? { isDecorative } : {}),
				placeholderType: placeholderInfo?.type,
				placeholderSz: placeholderInfo?.sz,
				placeholderOrient: placeholderInfo?.orient,
				inheritedPlaceholderText: inheritsPlaceholderText ? text : undefined,
				x,
				y,
				width,
				height,
				xEmu,
				yEmu,
				widthEmu,
				heightEmu,
				text,
				textStyle: hasText || promptText ? textStyle : undefined,
				// A body whose only paragraph is EMPTY still produces a segment:
				// the zero-length carrier of its `a:endParaRPr` / `a:pPr`, which
				// is what PowerPoint sizes and styles that blank line from.
				// Gating on `hasText` alone threw it away and the writer rebuilt
				// the paragraph as a bare `<a:endParaRPr lang="en-US"/>` stub.
				textSegments: hasText || textSegments.length > 0 ? textSegments : undefined,
				paragraphIndents: hasText && paragraphIndents.length > 0 ? paragraphIndents : undefined,
				promptText,
				linkedTxbxId,
				linkedTxbxSeq,
				shapeType: isPlainRect ? 'rect' : shapeType,
				shapeAdjustments,
				adjustmentHandles,
				shapeStyle,
				extLstXml: opaqueExtLstXml,
				rotation,
				skewX,
				skewY,
				flipHorizontal,
				flipVertical,
				actionClick,
				actionHover,
				locks,
				rawXml: shape,
			};

			if (type === 'text') {
				return { ...commonProps, type: 'text' as const };
			}

			return {
				...commonProps,
				type: 'shape' as const,
				pathData,
				pathWidth,
				pathHeight,
				customGeometryRawData,
				customGeometryAdjustHandlesXY,
				customGeometryAdjustHandlesPolar,
				customGeometryConnectionSites,
				customGeometryTextRect,
				customGeometryPaths,
			};
		} catch (e) {
			console.warn(`[pptx] Skipping shape element (${id}):`, e);
			return null;
		}
	}
}
