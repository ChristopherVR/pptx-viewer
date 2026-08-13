import { XmlObject, TextSegment, TextStyle } from '../../types';
import { xmlText } from '../../utils';
import { parseParagraphLevel } from '../../utils/paragraph-properties-parser';
import { breakAutoNumberRun, nextAutoNumber } from './auto-number-sequence';
import { paragraphContentEntries } from './paragraph-sibling-order';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeShapeTextParsing';
import type { ShapeTextParsingContext, ParagraphContentResult } from './PptxHandlerRuntimeTypes';

/** `a:p` children that contribute renderable content, in no particular order. */
const PARAGRAPH_CONTENT_TAGS: ReadonlySet<string> = new Set([
	'a:r',
	'a:fld',
	'a:t',
	'a14:m',
	'm:oMathPara',
	'm:oMath',
	'mc:AlternateContent',
	'a:br',
]);

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Collect text content (runs, fields, equations, bullets) for a single
	 * paragraph and return text parts + segments.  The returned `seedStyle`
	 * is the style from the first concrete content (used by the caller to
	 * seed the shape-level textStyle).
	 */
	protected collectShapeParagraphContent(
		p: XmlObject,
		pIdx: number,
		paraCount: number,
		paraAlign: TextStyle['align'],
		mergedDefaultRunStyle: TextStyle,
		ctx: ShapeTextParsingContext,
	): ParagraphContentResult {
		const parts: string[] = [];
		const segments: TextSegment[] = [];
		let seedStyle: TextStyle | undefined;

		const maybeSeed = (style: TextStyle) => {
			if (!seedStyle) {
				seedStyle = { ...style };
			}
		};

		// Bullet info
		const isBodyPlaceholder =
			ctx.placeholderInfo?.type === 'body' || ctx.placeholderInfo?.type === 'obj';
		const paragraphBulletInfo = this.resolveParagraphBulletInfo(
			p as XmlObject,
			pIdx,
			ctx.txBody as XmlObject,
			ctx.inheritedTxBody,
			isBodyPlaceholder,
			ctx.slidePath,
			ctx.effectiveLevelStyles,
		);
		const paragraphLevel = parseParagraphLevel(p['a:pPr'] as XmlObject | undefined);
		const autoNumScheme =
			paragraphBulletInfo && !paragraphBulletInfo.none && !paragraphBulletInfo.char
				? paragraphBulletInfo.autoNumType
				: undefined;
		// Anything that is not a continuation of the list running at this level
		// ends that list, so the next numbered paragraph counts from its own
		// `startAt` again rather than from the top of the text body.
		let autoNumOrdinal: number | undefined;
		if (autoNumScheme) {
			autoNumOrdinal = nextAutoNumber(
				ctx.autoNumbering,
				paragraphLevel,
				autoNumScheme,
				paragraphBulletInfo?.autoNumStartAt ?? 1,
			);
			if (paragraphBulletInfo) {
				// Consumers that re-derive the marker from `BulletInfo` alone
				// (the renderer's `resolveParagraphBullet`, the Markdown
				// converter's `resolveListMarker`) compute
				// `autoNumStartAt + paragraphIndex`. Publishing the ordinal's
				// OFFSET here rather than the raw paragraph position is what
				// makes them land on the sequence resolved above, which is the
				// only one that accounts for a list interrupted by an unnumbered
				// paragraph. With the raw position, a list that did not start at
				// the first paragraph of the body numbered one way here and
				// another way in the renderer, and BOTH markers were painted
				// ("3.1. Item"), since the paragraph builder drops the parsed
				// marker segment only when the two strings agree.
				paragraphBulletInfo.paragraphIndex =
					autoNumOrdinal - (paragraphBulletInfo.autoNumStartAt ?? 1);
			}
		} else {
			breakAutoNumberRun(ctx.autoNumbering, paragraphLevel);
		}

		if (paragraphBulletInfo && !paragraphBulletInfo.none) {
			let bulletText: string;
			if (paragraphBulletInfo.char) {
				bulletText = `${paragraphBulletInfo.char} `;
			} else if (autoNumScheme && autoNumOrdinal !== undefined) {
				bulletText = this.formatAutoNumber(autoNumScheme, autoNumOrdinal);
			} else if (paragraphBulletInfo.imageRelId || paragraphBulletInfo.imageDataUrl) {
				// A picture bullet HAS no text marker: the image is the marker,
				// and every renderer paints it from `bulletInfo` (an `<img>`, or
				// the '•' fallback when the image cannot be resolved). Stamping
				// a stand-in glyph here (it used to be a paperclip emoji) simply
				// added a second, competing marker: the paragraph builder drops
				// the parsed marker segment only when its text equals the marker
				// the renderer resolved, and a paperclip never equals a picture,
				// so every picture-bullet paragraph painted "📎" next to the
				// image in all five bindings. The segment itself is kept: it
				// carries `bulletInfo` for the renderers and the writer.
				bulletText = '';
			} else {
				bulletText = '• ';
			}
			// With no `a:buSzPct` / `a:buSzPts`, PowerPoint draws the bullet at
			// 100% of the FIRST TEXT RUN's size, not at the text body's default.
			// Using `mergedDefaultRunStyle` alone made a bullet on an 8pt run
			// render at the 18pt body default - a ~2.2x oversized glyph, and
			// visibly inconsistent between paragraphs (one that happened to carry
			// an `a:endParaRPr sz` picked the right size up by accident).
			const bulletStyle = { ...mergedDefaultRunStyle } as TextStyle;
			if (
				paragraphBulletInfo.sizePercent === undefined &&
				paragraphBulletInfo.sizePts === undefined
			) {
				const firstRunSize = this.resolveFirstRunFontSize(p, paraAlign, ctx);
				if (firstRunSize !== undefined) {
					bulletStyle.fontSize = firstRunSize;
				}
			}
			if (bulletText) {
				parts.push(bulletText);
			}
			segments.push({
				text: bulletText,
				style: bulletStyle,
				bulletInfo: paragraphBulletInfo,
			});
			maybeSeed(mergedDefaultRunStyle);
		}

		const appendRun = (runText: string, runProps: XmlObject | undefined) => {
			const runStyle = {
				...mergedDefaultRunStyle,
				...this.extractTextRunStyle(runProps, paraAlign, ctx.slideRelationshipMap),
			} as TextStyle;
			// #83: annotate a per-script fallback face when the run's text is
			// dominantly CJK / Arabic / Hebrew / Thai and the theme declares a
			// `<a:font script=...>` override. Rendering hint only — never
			// round-tripped, so the authored typefaces are untouched.
			if (!runStyle.scriptFallbackFont) {
				const fallback = this.resolveScriptFallbackFont(runText);
				if (fallback) {
					runStyle.scriptFallbackFont = fallback;
				}
			}
			parts.push(runText);
			segments.push({ text: runText, style: runStyle });
			maybeSeed(runStyle);
		};

		const processRun = (r: XmlObject) => {
			if (!r) {
				return;
			}

			// ── Ruby (phonetic guide) support ──
			const rubyNode = r['a:ruby'] as XmlObject | undefined;
			if (rubyNode) {
				const rubySegment = this.parseRubyElement(
					rubyNode,
					r['a:rPr'] as XmlObject | undefined,
					paraAlign,
					mergedDefaultRunStyle,
					ctx.slideRelationshipMap,
				);
				if (rubySegment) {
					parts.push(rubySegment.text);
					segments.push(rubySegment);
					maybeSeed(rubySegment.style);
					return;
				}
			}

			const runText = xmlText(r['a:t']) ?? '';
			appendRun(runText, r['a:rPr'] as XmlObject | undefined);
		};

		const processField = (field: XmlObject | undefined) => {
			if (!field) {
				return;
			}
			const fieldText = xmlText(field['a:t']) ?? '';
			const fieldRunStyle = {
				...mergedDefaultRunStyle,
				...this.extractTextRunStyle(
					field['a:rPr'] as XmlObject | undefined,
					paraAlign,
					ctx.slideRelationshipMap,
				),
			} as TextStyle;
			const fldType = String(field['@_type'] || '').trim() || undefined;
			const uuidAttr = String(field['@_uuid'] || '').trim();
			const idAttr = String(field['@_id'] || '').trim();
			const fldGuid = uuidAttr || idAttr || undefined;
			// Track which attribute spelling authored the guid so the writer
			// round-trips `@uuid` vs `@id` instead of always normalising to `@id`.
			const fldGuidAttr: 'uuid' | 'id' | undefined = uuidAttr ? 'uuid' : idAttr ? 'id' : undefined;
			parts.push(fieldText);
			const fieldSegment: TextSegment = {
				text: fieldText,
				style: fieldRunStyle,
				fieldType: fldType,
				fieldGuid: fldGuid,
			};
			if (fldGuidAttr) {
				fieldSegment.fieldGuidAttr = fldGuidAttr;
			}
			// Preserve a per-field `a:pPr` (the schema permits paragraph
			// properties inside `a:fld`) verbatim for round-trip.
			const fieldPPr = field['a:pPr'];
			if (fieldPPr && typeof fieldPPr === 'object') {
				fieldSegment.fieldParagraphPropertiesXml = fieldPPr as XmlObject;
			}
			segments.push(fieldSegment);
			maybeSeed(fieldRunStyle);
		};

		const processMathElement = (mathEl: unknown) => {
			if (!mathEl) {
				return;
			}
			const eqText = '[Equation]';
			parts.push(eqText);
			segments.push({
				text: eqText,
				style: { ...mergedDefaultRunStyle },
				equationXml: mathEl as Record<string, unknown>,
			});
		};

		const processAlternateContent = (ac: unknown) => {
			const choice = this.selectAlternateContentBranch(ac as XmlObject);
			if (!choice) {
				return;
			}
			const innerMath = choice['a14:m'] ?? choice['m:oMathPara'] ?? choice['m:oMath'];
			if (innerMath) {
				// mc:AlternateContent wrapping inline math
				processMathElement(innerMath);
				return;
			}
			// mc:AlternateContent may contain non-math content (runs, fields)
			const innerRuns = this.ensureArray(choice['a:r']);
			for (const r of innerRuns) {
				processRun(r);
			}
			const innerFields = this.ensureArray(choice['a:fld']);
			for (const f of innerFields) {
				processField(f as XmlObject);
			}
		};

		// ── Process paragraph children in document order ──
		// Runs (a:r), fields (a:fld), inline math (a14:m / m:oMathPara /
		// m:oMath), mc:AlternateContent, line breaks (a:br) and direct text
		// (a:t) all interleave freely in CT_TextParagraph, but fast-xml-parser
		// collapses same-tag siblings under one key, so iterating the parsed
		// keys re-emits them GROUPED BY TAG: an authored
		// `"Slide " <a:fld/> " - " <a:fld/>` came back as both literal runs and
		// only then both fields, i.e. every inline field jumped to the end of
		// its paragraph. `paragraphContentEntries` replays the order recovered
		// from the raw XML at parse time, and reports `authored: false` when
		// there was nothing to recover (already grouped, or SDK-built).
		const { entries, authored } = paragraphContentEntries(p, PARAGRAPH_CONTENT_TAGS, (value) =>
			this.ensureArray(value),
		);
		const runCount = this.ensureArray(p['a:r']).length;
		const breakCount = this.ensureArray(p['a:br']).length;
		// Legacy repair, kept for the grouped case only: with the true order
		// unknown, breaks were spread one-per-gap between the runs. When the
		// authored order IS known it is used verbatim instead, which is both
		// correct and avoids the synthetic break the repair would add.
		const insertCollapsedBreaks = !authored && runCount > 1 && breakCount > 0;
		let runIndex = 0;

		for (const [key, item] of entries) {
			switch (key) {
				case 'a:r': {
					processRun(item as XmlObject);
					if (insertCollapsedBreaks && runIndex < Math.min(runCount - 1, breakCount)) {
						parts.push('\n');
						segments.push({
							text: '\n',
							style: { ...mergedDefaultRunStyle },
							isLineBreak: true,
						});
					}
					runIndex++;
					break;
				}
				case 'a:fld':
					processField(item as XmlObject);
					break;
				case 'a:t': {
					const directText =
						typeof item === 'string' ? item : item !== undefined ? String(item) : '';
					appendRun(directText, p['a:rPr'] as XmlObject | undefined);
					break;
				}
				case 'a14:m':
				case 'm:oMathPara':
				case 'm:oMath':
					processMathElement(item);
					break;
				case 'mc:AlternateContent':
					processAlternateContent(item);
					break;
				case 'a:br': {
					const brNode = (item ?? {}) as XmlObject;
					const brRunProps = brNode['a:rPr'] as XmlObject | undefined;
					const brStyle = {
						...mergedDefaultRunStyle,
						...this.extractTextRunStyle(brRunProps, paraAlign, ctx.slideRelationshipMap),
					} as TextStyle;
					parts.push('\n');
					const brSegment: TextSegment = {
						text: '\n',
						style: brStyle,
						isLineBreak: true,
					};
					if (brRunProps && typeof brRunProps === 'object') {
						// Preserve the raw a:rPr for round-trip serialisation.
						brSegment.breakRunProperties = { ...(brRunProps as Record<string, unknown>) };
					}
					segments.push(brSegment);
					break;
				}
			}
		}

		if (pIdx < paraCount - 1) {
			const separatorStyle = { ...mergedDefaultRunStyle } as TextStyle;
			// An EMPTY paragraph's line box takes its size from `a:endParaRPr sz`
			// (PowerPoint sizes the blank line the way it would size a caret on
			// it). The paragraph has no run to carry that size, so stamp it on
			// the terminating separator segment; the renderers read it back when
			// they build the blank line's strut (issue #131, slides 13-14: a
			// 10pt blank line rendered at the 10.5pt body default, and the error
			// accumulated down the panel).
			if (segments.length === 0) {
				const endParaSz = (p['a:endParaRPr'] as XmlObject | undefined)?.['@_sz'];
				const endParaPoints = endParaSz !== undefined ? parseInt(String(endParaSz)) / 100 : NaN;
				if (Number.isFinite(endParaPoints) && endParaPoints > 0) {
					separatorStyle.fontSize = endParaPoints * (96 / 72);
				}
			}
			parts.push('\n');
			segments.push({ text: '\n', style: separatorStyle });
		} else if (segments.length === 0 && this.paragraphCarriesOwnMetadata(p)) {
			// The LAST paragraph of a body gets no terminating separator, so an
			// empty one produced no segment at all and its `a:endParaRPr` /
			// `a:pPr` were captured nowhere: the writer then rebuilt it as the
			// bare `<a:endParaRPr lang="en-US"/>` stub, destroying the size,
			// weight, underline (`a:uLnTx` / `a:uFillTx`), colour and typeface
			// PowerPoint uses to lay out that BLANK line. A whole text body that
			// is one empty paragraph (very common: decorative auto-layout
			// rectangles) lost its end properties outright.
			//
			// A zero-length segment carries them instead. It adds no run to the
			// saved paragraph that was not already there (the writer emits one
			// empty run for an empty paragraph either way) and no text to the
			// element, and it takes the blank line's size from `a:endParaRPr sz`
			// exactly as the separator above does.
			const emptyParagraphStyle = { ...mergedDefaultRunStyle } as TextStyle;
			const endParaSz = (p['a:endParaRPr'] as XmlObject | undefined)?.['@_sz'];
			const endParaPoints = endParaSz !== undefined ? parseInt(String(endParaSz)) / 100 : NaN;
			if (Number.isFinite(endParaPoints) && endParaPoints > 0) {
				emptyParagraphStyle.fontSize = endParaPoints * (96 / 72);
			}
			segments.push({ text: '', style: emptyParagraphStyle });
		}

		// Attach paragraph-level metadata to the first segment of this
		// paragraph so it survives a round-trip. Matches the existing
		// convention used for `bulletInfo`.
		const firstSegmentIndex = segments.length === 0 ? -1 : 0;
		if (firstSegmentIndex >= 0) {
			const pPrRaw = p['a:pPr'] as XmlObject | undefined;
			const lvlRaw = pPrRaw?.['@_lvl'];
			if (lvlRaw !== undefined) {
				const lvlParsed = Number.parseInt(String(lvlRaw), 10);
				if (Number.isFinite(lvlParsed) && lvlParsed > 0) {
					segments[firstSegmentIndex].paragraphLevel = Math.min(Math.max(lvlParsed, 0), 8);
				}
			}
			const endParaRPrRaw = p['a:endParaRPr'];
			if (endParaRPrRaw && typeof endParaRPrRaw === 'object') {
				// Shallow clone so later mutations on the writer side don't
				// leak back into the parsed XML object that other parts of
				// the load pipeline still hold a reference to.
				segments[firstSegmentIndex].endParaRunProperties = {
					...(endParaRPrRaw as Record<string, unknown>),
				};
			}
			// #69: capture this paragraph's own pPr geometry so per-paragraph
			// alignment / spacing / margins / indent / tabs round-trip instead
			// of being flattened to one shape-level pPr on save.
			const basisFontSize =
				typeof mergedDefaultRunStyle.fontSize === 'number'
					? mergedDefaultRunStyle.fontSize
					: undefined;
			const paragraphOwnProps = this.extractParagraphOwnProperties(p, basisFontSize);
			if (paragraphOwnProps) {
				segments[firstSegmentIndex].paragraphProperties = paragraphOwnProps;
			}
		}

		return { parts, segments, seedStyle };
	}

	/**
	 * True when a paragraph authored properties of its own that only a segment
	 * can carry through the model: its end-paragraph run properties
	 * (`a:endParaRPr`) or its paragraph properties (`a:pPr`). Used to decide
	 * whether an EMPTY trailing paragraph is worth a zero-length segment; a
	 * genuinely bare `<a:p/>` gets none.
	 */
	protected paragraphCarriesOwnMetadata(p: XmlObject): boolean {
		return p['a:endParaRPr'] !== undefined || p['a:pPr'] !== undefined;
	}

	/**
	 * Font size (px) of the first text run in a paragraph, or `undefined` when
	 * the paragraph has no run that declares one.
	 *
	 * Used to size an unsized bullet the way PowerPoint does: `a:buChar` /
	 * `a:buAutoNum` with no `a:buSzPct`/`a:buSzPts` inherits the first run's
	 * size. Only `a:r` and `a:fld` carry renderable text; `a:br` does not.
	 */
	protected resolveFirstRunFontSize(
		p: XmlObject,
		paraAlign: TextStyle['align'],
		ctx: ShapeTextParsingContext,
	): number | undefined {
		for (const key of ['a:r', 'a:fld'] as const) {
			const node = p[key];
			if (!node) {
				continue;
			}
			const first = (this.ensureArray(node) as XmlObject[])[0];
			const runProps = first?.['a:rPr'] as XmlObject | undefined;
			if (!runProps) {
				continue;
			}
			const style = this.extractTextRunStyle(runProps, paraAlign, ctx.slideRelationshipMap);
			if (typeof style.fontSize === 'number') {
				return style.fontSize;
			}
		}
		return undefined;
	}

	/**
	 * Parse an `a:ruby` element into a {@link TextSegment} with ruby annotation metadata.
	 *
	 * OOXML structure:
	 * ```xml
	 * <a:ruby>
	 *   <a:rubyPr>
	 *     <a:rubyAlign val="ctr"/>
	 *   </a:rubyPr>
	 *   <a:rt><a:r><a:rPr .../><a:t>phonetic</a:t></a:r></a:rt>
	 *   <a:rubyBase><a:r><a:rPr .../><a:t>base</a:t></a:r></a:rubyBase>
	 * </a:ruby>
	 * ```
	 */
	protected parseRubyElement(
		rubyNode: XmlObject,
		runProps: XmlObject | undefined,
		paraAlign: TextStyle['align'],
		mergedDefaultRunStyle: TextStyle,
		slideRelationshipMap: Map<string, string> | undefined,
	): TextSegment | undefined {
		// Extract ruby properties
		const rubyPr = rubyNode['a:rubyPr'] as XmlObject | undefined;
		const rubyAlign =
			String(
				rubyPr?.['@_algn'] ??
					(rubyPr?.['a:rubyAlign'] as XmlObject | undefined)?.['@_val'] ??
					'ctr',
			).trim() || 'ctr';

		// Extract ruby text (phonetic annotation) from a:rt
		const rtNode = rubyNode['a:rt'] as XmlObject | undefined;
		let rubyText = '';
		let rubyFontSize: number | undefined;
		let rubyStyle: TextStyle | undefined;
		if (rtNode) {
			const rtRuns = this.ensureArray(rtNode['a:r']);
			const rtParts: string[] = [];
			for (const rtRun of rtRuns) {
				if (!rtRun) {
					continue;
				}
				const rtRunObj = rtRun as XmlObject;
				const t = rtRunObj['a:t'];
				if (t !== undefined) {
					rtParts.push(xmlText(t) ?? '');
				}
				// Parse style from the first ruby text run
				if (!rubyStyle) {
					rubyStyle = {
						...mergedDefaultRunStyle,
						...this.extractTextRunStyle(
							rtRunObj['a:rPr'] as XmlObject | undefined,
							paraAlign,
							slideRelationshipMap,
						),
					} as TextStyle;
					if (rubyStyle.fontSize) {
						rubyFontSize = rubyStyle.fontSize;
					}
				}
			}
			rubyText = rtParts.join('');
		}

		// Extract base text from a:rubyBase
		const rubyBaseNode = rubyNode['a:rubyBase'] as XmlObject | undefined;
		let baseText = '';
		let baseStyle: TextStyle = { ...mergedDefaultRunStyle };
		if (rubyBaseNode) {
			const baseRuns = this.ensureArray(rubyBaseNode['a:r']);
			const baseParts: string[] = [];
			for (const baseRun of baseRuns) {
				if (!baseRun) {
					continue;
				}
				const baseRunObj = baseRun as XmlObject;
				const t = baseRunObj['a:t'];
				if (t !== undefined) {
					baseParts.push(xmlText(t) ?? '');
				}
				// Use style from the first base run
				if (baseParts.length === 1) {
					baseStyle = {
						...mergedDefaultRunStyle,
						...this.extractTextRunStyle(
							baseRunObj['a:rPr'] as XmlObject | undefined,
							paraAlign,
							slideRelationshipMap,
						),
					} as TextStyle;
				}
			}
			baseText = baseParts.join('');
		}

		// Also merge outer run props (a:rPr on the containing a:r)
		if (runProps) {
			const outerStyle = this.extractTextRunStyle(
				runProps as XmlObject | undefined,
				paraAlign,
				slideRelationshipMap,
			);
			baseStyle = { ...baseStyle, ...outerStyle };
		}

		if (!baseText && !rubyText) {
			return undefined;
		}

		// Check for hps (half-point size) on rubyPr
		if (rubyPr?.['@_hps'] !== undefined && rubyFontSize === undefined) {
			const hps = Number.parseInt(String(rubyPr['@_hps']), 10);
			if (Number.isFinite(hps)) {
				rubyFontSize = hps / 2; // half-points to points
			}
		}

		return {
			text: baseText,
			style: baseStyle,
			rubyText,
			rubyAlignment: rubyAlign,
			rubyFontSize,
			rubyStyle,
		};
	}
}
