import { XmlObject, TextStyle, TextSegment } from '../../types';
import type { BulletInfo } from '../../types';
import {
	buildParagraphPropertiesXml,
	assembleParagraphXml,
	computeUniformSegmentOverrides,
} from './PptxHandlerRuntimeSaveParagraphHelpers';
import type { ParagraphSpacingConfig } from './PptxHandlerRuntimeSaveParagraphHelpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveRunProperties';
import { toRunScopedTextStyle } from './run-scoped-text-style';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	private isRenderedBulletMarker(segment: TextSegment): boolean {
		const bullet = segment.bulletInfo;
		if (!bullet) {
			return false;
		}
		const marker = bullet.char
			? `${bullet.char} `
			: bullet.imageRelId || bullet.imageDataUrl
				? '\u{1F4CE} '
				: bullet.autoNumType
					? undefined
					: '• ';
		return marker ? segment.text === marker : bullet.paragraphIndex !== undefined;
	}

	protected createParagraphsFromTextContent(
		text: string | undefined,
		textStyle: TextStyle | undefined,
		textSegments: TextSegment[] | undefined,
		resolveHyperlinkRelationshipId?: (target: string) => string | undefined,
	): XmlObject[] {
		// `a:pPr` wants the element style whole; every `a:rPr` must not inherit
		// its paragraph-only members. See `toRunScopedTextStyle`.
		const runScopedTextStyle = toRunScopedTextStyle(textStyle);
		// #69: Each paragraph's own pPr geometry (align / spacing / margins /
		// indent / tabs / rtl), carried on the first segment as
		// `paragraphProperties`, overrides the shape-level style for that
		// paragraph. Paragraphs without their own properties fall back to the
		// shape-level style, preserving prior behaviour for SDK-built text.
		// `paragraphProperties` also travels to the builder as the authored set,
		// so the shape-level half of the merge is not written back as explicit
		// per-paragraph values (see `buildParagraphPropertiesXml`).
		const createParagraph = (
			runs: XmlObject[],
			bulletInfo?: BulletInfo,
			level?: number,
			endParaRunProperties?: Record<string, unknown>,
			paragraphProperties?: TextStyle,
		): XmlObject => {
			const effectiveStyle: TextStyle | undefined = paragraphProperties
				? ({ ...textStyle, ...paragraphProperties } as TextStyle)
				: textStyle;
			const paragraphAlign = this.textAlignToDrawingValue(effectiveStyle?.align);
			const spacing: ParagraphSpacingConfig = {
				spacingBefore: this.createParagraphSpacingXmlFromPx(effectiveStyle?.paragraphSpacingBefore),
				spacingAfter: this.createParagraphSpacingXmlFromPx(effectiveStyle?.paragraphSpacingAfter),
				lineSpacing: this.createLineSpacingXmlFromMultiplier(effectiveStyle?.lineSpacing),
				lineSpacingExactPt: effectiveStyle?.lineSpacingExactPt,
			};
			const paragraphProps = buildParagraphPropertiesXml(
				effectiveStyle,
				paragraphAlign,
				bulletInfo,
				spacing,
				level,
				paragraphProperties,
			);
			return assembleParagraphXml(runs, paragraphProps, endParaRunProperties);
		};

		const createTextNode = (value: string): string | XmlObject =>
			/^[\t\n\r ]|[\t\n\r ]$/.test(value) ? { '@_xml:space': 'preserve', '#text': value } : value;

		const createRun = (runText: string, style: TextStyle | undefined) => ({
			'a:rPr': this.createRunPropertiesFromTextStyle(style, resolveHyperlinkRelationshipId),
			'a:t': createTextNode(runText),
		});

		const createFieldRun = (
			runText: string,
			style: TextStyle | undefined,
			fieldType: string,
			fieldGuid?: string,
			fieldGuidAttr?: 'uuid' | 'id',
			fieldParagraphPropertiesXml?: XmlObject,
		) => {
			// CT_TextField child order: rPr?, pPr?, t?. Assign keys in that exact
			// sequence (fast-xml-parser serialises in insertion order).
			const fld: XmlObject = { '@_type': fieldType };
			if (fieldGuid) {
				// Round-trip whichever attribute spelling the source authored.
				if (fieldGuidAttr === 'uuid') {
					fld['@_uuid'] = fieldGuid;
				} else {
					fld['@_id'] = fieldGuid;
				}
			}
			fld['a:rPr'] = this.createRunPropertiesFromTextStyle(style, resolveHyperlinkRelationshipId);
			if (fieldParagraphPropertiesXml && typeof fieldParagraphPropertiesXml === 'object') {
				fld['a:pPr'] = fieldParagraphPropertiesXml;
			}
			fld['a:t'] = createTextNode(runText);
			return fld;
		};

		/**
		 * Create a run with `a:ruby` containing phonetic annotation.
		 * Produces the OOXML `a:r > a:ruby > { a:rubyPr, a:rt, a:rubyBase }` structure.
		 */
		const createRubyRun = (segment: TextSegment, style: TextStyle) => {
			const rubyPr: XmlObject = {};
			if (segment.rubyAlignment) {
				rubyPr['@_algn'] = segment.rubyAlignment;
			}
			if (segment.rubyFontSize !== undefined) {
				// Store as half-point size (hps)
				rubyPr['@_hps'] = String(Math.round(segment.rubyFontSize * 2));
			}
			// Ruby text run (phonetic annotation)
			const rtRunProps = this.createRunPropertiesFromTextStyle(
				segment.rubyStyle ?? style,
				resolveHyperlinkRelationshipId,
			);
			const rtRun = {
				'a:rPr': rtRunProps,
				'a:t': createTextNode(segment.rubyText ?? ''),
			};
			// Base text run
			const baseRunProps = this.createRunPropertiesFromTextStyle(
				style,
				resolveHyperlinkRelationshipId,
			);
			const baseRun = {
				'a:rPr': baseRunProps,
				'a:t': createTextNode(segment.text),
			};
			return {
				'a:rPr': this.createRunPropertiesFromTextStyle(style, resolveHyperlinkRelationshipId),
				'a:ruby': {
					'a:rubyPr': rubyPr,
					'a:rt': { 'a:r': rtRun },
					'a:rubyBase': { 'a:r': baseRun },
				},
			};
		};

		const paragraphs: XmlObject[] = [];
		let currentRuns: XmlObject[] = [];
		let currentBulletInfo: BulletInfo | undefined;
		let currentLevel: number | undefined;
		let currentEndParaRunProperties: Record<string, unknown> | undefined;
		let currentParagraphProperties: TextStyle | undefined;
		// #69: track whether this paragraph has taken its metadata yet.
		// `currentRuns.length === 0` cannot stand in for "new paragraph", because
		// a paragraph-break segment (`\n`) can open one that has no runs yet, and
		// testing the run count would miss the metadata on the *next* paragraph's
		// first segment (dropping its per-paragraph pPr / level).
		let capturedParagraphMeta = false;
		const pushParagraph = (): void => {
			if (currentRuns.length === 0) {
				currentRuns.push(createRun('', runScopedTextStyle));
			}
			paragraphs.push(
				createParagraph(
					currentRuns,
					currentBulletInfo,
					currentLevel,
					currentEndParaRunProperties,
					currentParagraphProperties,
				),
			);
			currentRuns = [];
			currentBulletInfo = undefined;
			currentLevel = undefined;
			currentEndParaRunProperties = undefined;
			currentParagraphProperties = undefined;
			capturedParagraphMeta = false;
		};

		if (textSegments && textSegments.length > 0) {
			// This pushes element-level edits back down onto previously uniform
			// runs, so it is a run destination too: passing the WHOLE element style
			// re-added the paragraph `rtl` the spread below had already dropped.
			const uniformSegmentOverrides = computeUniformSegmentOverrides(
				runScopedTextStyle,
				textSegments,
			);

			textSegments.forEach((segment) => {
				const segmentStyle = {
					...runScopedTextStyle,
					...segment.style,
					...uniformSegmentOverrides,
				} as TextStyle;

				// Capture paragraph-level metadata from the first segment of each paragraph.
				if (!capturedParagraphMeta) {
					if (segment.bulletInfo) {
						currentBulletInfo = segment.bulletInfo;
					}
					if (segment.paragraphLevel !== undefined) {
						currentLevel = segment.paragraphLevel;
					}
					if (segment.endParaRunProperties) {
						currentEndParaRunProperties = segment.endParaRunProperties;
					}
					if (segment.paragraphProperties) {
						currentParagraphProperties = segment.paragraphProperties;
					}
					capturedParagraphMeta = true;
				}

				// Parsed bullet markers are display-only segments. The native
				// paragraph properties above already represent them in OOXML.
				if (this.isRenderedBulletMarker(segment)) {
					return;
				}

				// Soft line break (`a:br`): emit a single br node inside the
				// current paragraph and never split into a new paragraph.
				if (segment.isLineBreak) {
					const brNode: XmlObject = {};
					if (segment.breakRunProperties && typeof segment.breakRunProperties === 'object') {
						brNode['a:rPr'] = { ...(segment.breakRunProperties as XmlObject) };
					} else {
						brNode['a:rPr'] = this.createRunPropertiesFromTextStyle(
							segmentStyle,
							resolveHyperlinkRelationshipId,
						);
					}
					(brNode as Record<string, unknown>)['__isLineBreak'] = true;
					currentRuns.push(brNode);
					return;
				}

				// Math equation segments: re-emit the original m:oMath /
				// m:oMathPara / mc:AlternateContent subtree captured at parse time.
				if (segment.equationXml && typeof segment.equationXml === 'object') {
					const eqNode = {
						__isEquation: true,
						__equationXml: segment.equationXml as Record<string, unknown>,
					} as unknown as XmlObject;
					currentRuns.push(eqNode);
					return;
				}

				const segmentText = String(segment.text ?? '');
				const lineParts = segmentText.split('\n');
				// A paragraph-break segment is the literal "\n", which splits into
				// two empty halves. Emitting a run for each of them appended one
				// empty `a:r` to the paragraph that closed AND to the one that
				// opened; the next load read those back as segments, which emitted
				// their own empty runs, so the run count grew by one per paragraph
				// on every save forever. Only a split product that carries text
				// deserves a run. A paragraph left with none still gets the single
				// empty run that `pushParagraph` backfills, so genuinely blank
				// lines keep their `endParaRPr`-sized placeholder.
				const isSplitProduct = lineParts.length > 1;

				lineParts.forEach((linePart, lineIndex) => {
					if (isSplitProduct && linePart.length === 0) {
						if (lineIndex < lineParts.length - 1) {
							pushParagraph();
						}
						return;
					}
					if (segment.rubyText !== undefined) {
						// Ruby segment: emit as a:ruby structure
						const rubySeg = { ...segment, text: linePart };
						currentRuns.push(createRubyRun(rubySeg, segmentStyle));
					} else if (segment.fieldType) {
						const fieldRun = createFieldRun(
							linePart,
							segmentStyle,
							segment.fieldType,
							segment.fieldGuid,
							segment.fieldGuidAttr,
							segment.fieldParagraphPropertiesXml,
						);
						(fieldRun as Record<string, unknown>).__isField = true;
						currentRuns.push(fieldRun);
					} else {
						currentRuns.push(createRun(linePart, segmentStyle));
					}
					if (lineIndex < lineParts.length - 1) {
						pushParagraph();
					}
				});
			});

			if (currentRuns.length > 0 || paragraphs.length === 0) {
				pushParagraph();
			}

			return paragraphs;
		}

		const normalizedText = typeof text === 'string' ? text : '';
		const textLines = normalizedText.split('\n');
		textLines.forEach((line) => {
			paragraphs.push(createParagraph([createRun(line, runScopedTextStyle)]));
		});

		if (paragraphs.length === 0) {
			paragraphs.push(createParagraph([createRun('', runScopedTextStyle)]));
		}

		return paragraphs;
	}
}
