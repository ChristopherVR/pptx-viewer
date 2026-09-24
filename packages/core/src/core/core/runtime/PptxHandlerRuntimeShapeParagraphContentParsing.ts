import { XmlObject, TextSegment, TextStyle } from '../../types';
import { xmlText } from '../../utils';
import { parseParagraphLevel } from '../../utils/paragraph-properties-parser';
import { xmlHasChild } from '../../utils/xml-access';
import { breakAutoNumberRun, nextAutoNumber } from './auto-number-sequence';
import { hasOwnFontDeclaration, paragraphContentEntries } from './paragraph-sibling-order';
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

		// Every run style below is `{...inherited, ...authored}`. Recording the
		// two halves alongside the flat result is what lets the writer emit a
		// sparse `a:rPr` again instead of baking the whole resolved cascade into
		// the run (see `authored-run-style.ts`). Both are stored by REFERENCE:
		// the baseline is this paragraph's single `mergedDefaultRunStyle`, so
		// the split costs two pointers per run, not two objects. A run with no
		// `a:rPr` of its own gets an EMPTY authored half, which is the whole
		// point: it authored nothing and must round-trip as `<a:rPr lang=".."/>`.
		const withAuthoredSplit = (authored: TextStyle): TextStyle =>
			({
				...mergedDefaultRunStyle,
				...authored,
				authoredRunStyle: authored,
				inheritedRunStyle: mergedDefaultRunStyle,
			}) as TextStyle;

		// Recovered here (rather than at its original use site below the bullet
		// block) because the bullet/auto-number logic ALSO needs to know
		// whether this paragraph has any actual content: see
		// `hasRenderableContent` immediately below.
		const { entries, authored } = paragraphContentEntries(p, PARAGRAPH_CONTENT_TAGS);
		// A bare `<a:endParaRPr/>` paragraph (no `a:r`/`a:fld`/equation/`a:br`)
		// is a blank line, not a list item: PowerPoint does not print an
		// auto-number next to it, and the NEXT numbered paragraph continues the
		// sequence as though the blank line were not there (COM-verified
		// against `audit-text/pp/s10.png`, `gen.py` slide 10's nested-list box,
		// where "two" is numbered 2 and "after empty" is numbered 3, skipping
		// the blank line between them entirely rather than making it 3 and the
		// next 4).
		const hasRenderableContent = entries.length > 0;

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
			// A blank line (no run/field/equation content) does not consume an
			// ordinal: leave `ctx.autoNumbering` completely untouched, neither
			// advancing nor breaking it, so it is invisible to the sequence and
			// the next real numbered paragraph continues from where the LAST
			// real one left off.
			if (hasRenderableContent) {
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
			}
		} else {
			breakAutoNumberRun(ctx.autoNumbering, paragraphLevel);
		}

		// An empty auto-numbered paragraph gets no marker segment at all (no
		// ordinal was resolved for it above); a char/picture bullet on an empty
		// paragraph is unaffected; PowerPoint still paints those.
		const showBulletMarker = hasRenderableContent || !autoNumScheme;
		if (paragraphBulletInfo && !paragraphBulletInfo.none && showBulletMarker) {
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
			// Unsized bullets and `a:buSzPct` use the FIRST TEXT RUN's size as
			// their base, not the text body's default. The renderer applies the
			// percentage; `a:buSzPts` is absolute and does not use this base.
			const bulletStyle = { ...mergedDefaultRunStyle } as TextStyle;
			// `mergedDefaultRunStyle` can pick up `align` from the placeholder's
			// level defaults (`applyPlaceholderLevelDefaults` fills any slot the
			// paragraph itself left undefined, and almost every body placeholder's
			// master `lstStyle` declares a level alignment). The renderer's
			// per-paragraph alignment resolution (`resolveParagraphAlign`) reads
			// segments in order and stops at the FIRST explicit `align`, and the
			// bullet marker is always that first segment, so a stale
			// placeholder-derived alignment here shadowed the paragraph's own
			// resolved `algn` on every bulleted paragraph. The marker's alignment
			// must always match its own paragraph, never the placeholder default.
			bulletStyle.align = paraAlign;
			if (paragraphBulletInfo.sizePts === undefined) {
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
			// The marker itself authored no `a:rPr`, and this is also what seeds
			// `element.textStyle` on a bulleted shape, which the writer falls back
			// to for any run it rebuilds from the flat text. Seeding it WITHOUT
			// the authored split would have re-flattened the whole cascade for
			// exactly the decks that need it most (every bulleted body).
			maybeSeed(withAuthoredSplit({}));
		}

		const appendRun = (runText: string, runProps: XmlObject | undefined) => {
			const runStyle = withAuthoredSplit(
				this.extractTextRunStyle(runProps, paraAlign, ctx.slideRelationshipMap),
			);
			// #83: annotate a per-script fallback face when the run's text is
			// dominantly CJK / Arabic / Hebrew / Thai and the theme declares a
			// `<a:font script=...>` override. Rendering hint only, never
			// round-tripped, so the authored typefaces are untouched.
			if (!runStyle.scriptFallbackFont) {
				const fallback = this.resolveScriptFallbackFont(runText);
				if (fallback) {
					runStyle.scriptFallbackFont = fallback;
					// The run's OWN `a:rPr` authors no latin/ea/cs font: the
					// `fontFamily` `withAuthoredSplit` just merged in above is purely
					// the paragraph/list-style/theme CASCADE default (typically
					// `+mn-lt`), which the renderer must let this fallback replace.
					// See `TextStyle.fontFamilyIsCascadeDefault`.
					if (!hasOwnFontDeclaration(runProps)) {
						runStyle.fontFamilyIsCascadeDefault = true;
					}
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
			const fieldRunStyle = withAuthoredSplit(
				this.extractTextRunStyle(
					field['a:rPr'] as XmlObject | undefined,
					paraAlign,
					ctx.slideRelationshipMap,
				),
			);
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
			// properties inside `a:fld`) verbatim for round-trip. An UNSTYLED
			// `<a:pPr/>` parses to the empty STRING (fast-xml-parser gives every
			// childless/attributeless element this way, same trap as `<p:spPr/>`
			// - see `ensureXmlChild`), so a truthy-object test here missed it and
			// the field's own empty pPr silently vanished on save.
			if (field['a:pPr'] !== undefined) {
				const fieldPPr = field['a:pPr'];
				fieldSegment.fieldParagraphPropertiesXml =
					typeof fieldPPr === 'object' && fieldPPr !== null ? (fieldPPr as XmlObject) : {};
			}
			segments.push(fieldSegment);
			maybeSeed(fieldRunStyle);
		};

		// `mathEl` is the resolved math content used for RENDERING: the shape
		// every consumer of `TextSegment.equationXml` already expects (at the
		// `a14:m` / `m:oMathPara` level, or directly at `m:oMath`). `wrapperTag`
		// + `wrapperNode` are the ORIGINAL top-level paragraph child exactly as
		// authored, captured separately onto `equationSourceXml` purely so the
		// writer can re-emit an untouched equation byte-for-byte: an
		// `mc:AlternateContent` equation keeps its Choice AND Fallback, and a
		// bare `a14:m` equation stays a bare `a14:m`, instead of either
		// collapsing to a bare math element PowerPoint's own writer never
		// produces.
		const processMathElement = (mathEl: unknown, wrapperTag: string, wrapperNode: unknown) => {
			if (!mathEl) {
				return;
			}
			const eqText = '[Equation]';
			parts.push(eqText);
			segments.push({
				text: eqText,
				style: { ...mergedDefaultRunStyle },
				equationXml: mathEl as Record<string, unknown>,
				equationSourceXml: { [wrapperTag]: wrapperNode } as Record<string, unknown>,
			});
		};

		const processAlternateContent = (ac: unknown) => {
			const choice = this.selectAlternateContentBranch(ac as XmlObject);
			if (!choice) {
				return;
			}
			const innerMath = choice['a14:m'] ?? choice['m:oMathPara'] ?? choice['m:oMath'];
			if (innerMath) {
				// mc:AlternateContent wrapping inline math: `equationSourceXml`
				// captures the WHOLE alternate-content node (its Choice and
				// Fallback both), not just the inline math inside the winning
				// Choice, so an untouched equation re-emits verbatim.
				processMathElement(innerMath, 'mc:AlternateContent', ac);
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
		// its paragraph. `paragraphContentEntries` (recovered above, alongside
		// `hasRenderableContent`) replays the order recovered from the raw XML
		// at parse time, and reports `authored: false` when there was nothing
		// to recover (already grouped, or SDK-built).
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
					processMathElement(item, key, item);
					break;
				case 'mc:AlternateContent':
					processAlternateContent(item);
					break;
				case 'a:br': {
					const brNode = (item ?? {}) as XmlObject;
					const brRunProps = brNode['a:rPr'] as XmlObject | undefined;
					const brStyle = withAuthoredSplit(
						this.extractTextRunStyle(brRunProps, paraAlign, ctx.slideRelationshipMap),
					);
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
			// The paragraph terminator authored no `a:rPr` of its own, so it takes
			// an EMPTY authored half. Without it, the empty run the writer
			// backfills for a blank paragraph came out carrying the whole
			// resolved cascade (`sz`, `a:solidFill`, `a:latin`): on
			// `issue-132-hr-deck.pptx` slide 1 that was 38 runs' worth of
			// flattening on a slide whose source declared 7 `a:rPr` in total.
			const separatorStyle = withAuthoredSplit({}) as TextStyle;
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
			const emptyParagraphStyle = withAuthoredSplit({}) as TextStyle;
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
			// A paragraph that explicitly suppressed its bullet produces no marker
			// segment, so nothing carried `bulletInfo` and the writer had no way to
			// know: `a:buNone` was dropped on save and the paragraph inherited a
			// bullet back from the list style, painting markers where the author
			// had removed them (56 lost on the Arabic RTL corpus deck alone).
			//
			// Only the paragraph's OWN `a:buNone` counts. `resolveParagraphBulletInfo`
			// also reports `none` when the suppression is INHERITED from a layout or
			// master list style, and writing that back onto the slide paragraph would
			// add markup the author never authored. `paragraphBulletInfo` is reused
			// as-is (rather than a fresh `{ none: true }`) because its top-level
			// check is this exact same condition on this exact same `a:pPr` node:
			// whenever it fires, `paragraphBulletInfo` is already `{ none: true,
			// ownedByParagraph: true, ...colorInherit/sizeInherit/fontInherit }`,
			// and dropping those extra fields here silently lost the independent
			// `buClrTx`/`buSzTx`/`buFontTx` "inherit from text" markers a paragraph
			// may still author alongside `buNone`.
			if (xmlHasChild(pPrRaw, 'a:buNone') && segments[firstSegmentIndex].bulletInfo === undefined) {
				segments[firstSegmentIndex].bulletInfo = paragraphBulletInfo ?? {
					none: true,
					ownedByParagraph: true,
				};
			}
			const lvlRaw = pPrRaw?.['@_lvl'];
			if (lvlRaw !== undefined) {
				const lvlParsed = Number.parseInt(String(lvlRaw), 10);
				if (Number.isFinite(lvlParsed) && lvlParsed > 0) {
					segments[firstSegmentIndex].paragraphLevel = Math.min(Math.max(lvlParsed, 0), 8);
				}
			}
			const endParaRPrRaw = p['a:endParaRPr'];
			if (endParaRPrRaw !== undefined) {
				// A present-but-attribute-less `<a:endParaRPr/>` parses to `''`
				// (fast-xml-parser gives a childless, attribute-less element back
				// as an empty string), which is NOT the same thing as the key
				// being absent: the element was authored, it just carries no
				// properties. Capturing it as `{}` re-emits an equally empty
				// element on save; treating `''` as "nothing captured" made the
				// writer fall back to its `lang="en-US"` stub, materializing an
				// attribute the source never had. Shallow clone so later
				// mutations on the writer side don't leak back into the parsed
				// XML object that other parts of the load pipeline still hold a
				// reference to.
				segments[firstSegmentIndex].endParaRunProperties =
					typeof endParaRPrRaw === 'object' && endParaRPrRaw !== null
						? { ...(endParaRPrRaw as Record<string, unknown>) }
						: {};
			}
			if (entries.length === 0) {
				segments[firstSegmentIndex].paragraphInsertionStyle = withAuthoredSplit(
					endParaRPrRaw && typeof endParaRPrRaw === 'object'
						? this.extractTextRunStyle(
								endParaRPrRaw as XmlObject,
								paraAlign,
								ctx.slideRelationshipMap,
							)
						: {},
				);
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
	 * that first run inherits its size.
	 *
	 * Used as the base for unsized and percentage-sized bullets. Only `a:r`
	 * and `a:fld` carry renderable text; `a:br` does not.
	 */
	protected resolveFirstRunFontSize(
		p: XmlObject,
		paraAlign: TextStyle['align'],
		ctx: ShapeTextParsingContext,
	): number | undefined {
		for (const [tag, node] of paragraphContentEntries(p, PARAGRAPH_CONTENT_TAGS).entries) {
			if (tag !== 'a:r' && tag !== 'a:fld') {
				continue;
			}
			const runProps = (node as XmlObject | undefined)?.['a:rPr'] as XmlObject | undefined;
			if (!runProps) {
				return undefined;
			}
			const style = this.extractTextRunStyle(runProps, paraAlign, ctx.slideRelationshipMap);
			return typeof style.fontSize === 'number' ? style.fontSize : undefined;
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
