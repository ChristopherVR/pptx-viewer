import { PptxElement, XmlObject, TextSegment, TextStyle } from '../../types';
import { xmlAttr, xmlChild, xmlPath } from '../../utils/xml-access';
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
			if (!xfrm) {
				return null;
			}

			const off = xmlChild(xfrm, 'a:off');
			const ext = xmlChild(xfrm, 'a:ext');
			if (!off || !ext) {
				return null;
			}

			const x = Math.round(parseInt(xmlAttr(off, 'x') || '0') / PptxHandlerRuntime.EMU_PER_PX);
			const y = Math.round(parseInt(xmlAttr(off, 'y') || '0') / PptxHandlerRuntime.EMU_PER_PX);
			const width = Math.round(parseInt(xmlAttr(ext, 'cx') || '0') / PptxHandlerRuntime.EMU_PER_PX);
			const height = Math.round(
				parseInt(xmlAttr(ext, 'cy') || '0') / PptxHandlerRuntime.EMU_PER_PX,
			);

			const rotation = xfrm['@_rot'] ? parseInt(xfrm['@_rot']) / 60000 : undefined;
			const skewX = xfrm['@_skewX'] ? parseInt(String(xfrm['@_skewX']), 10) / 60000 : undefined;
			const skewY = xfrm['@_skewY'] ? parseInt(String(xfrm['@_skewY']), 10) / 60000 : undefined;
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
			const txBody = shape['p:txBody'] || inheritedPlaceholder?.shape?.['p:txBody'];
			const inheritedTxBody = inheritedPlaceholder?.shape?.['p:txBody'] as XmlObject | undefined;
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
			if (!textStyle.fontFamily && fontRefIdx.length > 0) {
				const token = fontRefIdx.includes('minor') ? '+mn-lt' : '+mj-lt';
				const resolved = this.resolveThemeTypeface(token);
				if (resolved) {
					textStyle.fontFamily = resolved;
				}
			}
			if (!textStyle.color) {
				textStyle.color = this.parseColor(fontRef);
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
			}

			// Extract shape style + determine element type
			const shapeStyle = this.extractShapeStyle(effectiveSpPr, styleNode);
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

			const commonProps = {
				id,
				name: elementName || undefined,
				x,
				y,
				width,
				height,
				text,
				textStyle: hasText || promptText ? textStyle : undefined,
				textSegments: hasText ? textSegments : undefined,
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
