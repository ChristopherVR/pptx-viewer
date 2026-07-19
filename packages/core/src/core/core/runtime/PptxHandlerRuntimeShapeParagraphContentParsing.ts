import { XmlObject, TextSegment, TextStyle } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeShapeTextParsing';
import type { ShapeTextParsingContext, ParagraphContentResult } from './PptxHandlerRuntimeTypes';

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
		if (paragraphBulletInfo && !paragraphBulletInfo.none) {
			let bulletText: string;
			if (paragraphBulletInfo.char) {
				bulletText = `${paragraphBulletInfo.char} `;
			} else if (paragraphBulletInfo.autoNumType) {
				const startAt = paragraphBulletInfo.autoNumStartAt ?? 1;
				bulletText = this.formatAutoNumber(paragraphBulletInfo.autoNumType, startAt + pIdx);
			} else if (paragraphBulletInfo.imageRelId) {
				bulletText = '\u{1F4CE} ';
			} else {
				bulletText = '• ';
			}
			parts.push(bulletText);
			segments.push({
				text: bulletText,
				style: { ...mergedDefaultRunStyle },
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

			const runText =
				typeof r['a:t'] === 'string' ? r['a:t'] : r['a:t'] !== undefined ? String(r['a:t']) : '';
			appendRun(runText, r['a:rPr'] as XmlObject | undefined);
		};

		const processField = (field: XmlObject | undefined) => {
			if (!field) {
				return;
			}
			const fieldText =
				typeof field['a:t'] === 'string'
					? field['a:t']
					: field['a:t'] !== undefined
						? String(field['a:t'])
						: '';
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
		// Iterate over object keys to preserve the interleaving order of
		// runs (a:r), fields (a:fld), inline math (a14:m / m:oMathPara /
		// m:oMath), mc:AlternateContent, line breaks (a:br), and direct
		// text (a:t). Each key's array items are consumed sequentially,
		// maintaining the positions of inline math relative to text runs.
		const contentTagSet = new Set([
			'a:r',
			'a:fld',
			'a:t',
			'a14:m',
			'm:oMathPara',
			'm:oMath',
			'mc:AlternateContent',
			'a:br',
		]);

		for (const key of Object.keys(p)) {
			if (!contentTagSet.has(key)) {
				continue;
			}

			const items = this.ensureArray(p[key]);
			const rawBreaks = p['a:br'];
			const breakCount = Array.isArray(rawBreaks)
				? rawBreaks.length
				: rawBreaks === undefined
					? 0
					: 1;
			const insertCollapsedBreaks = key === 'a:r' && items.length > 1 && breakCount > 0;
			for (const [itemIndex, item] of items.entries()) {
				switch (key) {
					case 'a:r': {
						processRun(item);
						if (insertCollapsedBreaks && itemIndex < Math.min(items.length - 1, breakCount)) {
							parts.push('\n');
							segments.push({
								text: '\n',
								style: { ...mergedDefaultRunStyle },
								isLineBreak: true,
							});
						}
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
						if (insertCollapsedBreaks) {
							break;
						}
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
		}

		if (pIdx < paraCount - 1) {
			parts.push('\n');
			segments.push({ text: '\n', style: { ...mergedDefaultRunStyle } });
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
					rtParts.push(typeof t === 'string' ? t : String(t));
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
					baseParts.push(typeof t === 'string' ? t : String(t));
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
