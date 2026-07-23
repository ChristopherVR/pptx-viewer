import { XmlObject, TextStyle, TextSegment } from '../../types';
import type { BulletInfo } from '../../types';
import {
	buildParagraphPropertiesXml,
	assembleParagraphXml,
	computeUniformSegmentOverrides,
} from './PptxHandlerRuntimeSaveParagraphHelpers';
import type { ParagraphSpacingConfig } from './PptxHandlerRuntimeSaveParagraphHelpers';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveRunProperties';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected createParagraphsFromTextContent(
		text: string | undefined,
		textStyle: TextStyle | undefined,
		textSegments: TextSegment[] | undefined,
		resolveHyperlinkRelationshipId?: (target: string) => string | undefined,
	): XmlObject[] {
		// #69: Each paragraph's own pPr geometry (align / spacing / margins /
		// indent / tabs / rtl), carried on the first segment as
		// `paragraphProperties`, overrides the shape-level style for that
		// paragraph. Paragraphs without their own properties fall back to the
		// shape-level style, preserving prior behaviour for SDK-built text.
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
			);
			return assembleParagraphXml(runs, paragraphProps, endParaRunProperties);
		};

		const createRun = (runText: string, style: TextStyle | undefined) => ({
			'a:rPr': this.createRunPropertiesFromTextStyle(style, resolveHyperlinkRelationshipId),
			'a:t': runText,
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
			fld['a:t'] = runText;
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
				'a:t': segment.rubyText ?? '',
			};
			// Base text run
			const baseRunProps = this.createRunPropertiesFromTextStyle(
				style,
				resolveHyperlinkRelationshipId,
			);
			const baseRun = {
				'a:rPr': baseRunProps,
				'a:t': segment.text,
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
		// #69: track whether this paragraph has taken its metadata yet. A
		// paragraph-break segment (`\n`) splits and leaves a trailing empty run,
		// so `currentRuns.length === 0` would miss the metadata on the *next*
		// paragraph's first segment (dropping its per-paragraph pPr / level).
		let capturedParagraphMeta = false;
		const pushParagraph = (): void => {
			if (currentRuns.length === 0) {
				currentRuns.push(createRun('', textStyle));
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
			const uniformSegmentOverrides = computeUniformSegmentOverrides(textStyle, textSegments);

			textSegments.forEach((segment) => {
				const segmentStyle = {
					...textStyle,
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

				// Soft line break (`a:br`) — emit a single br node inside the
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

				// Math equation segments — re-emit the original m:oMath /
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

				lineParts.forEach((linePart, lineIndex) => {
					if (segment.rubyText !== undefined) {
						// Ruby segment — emit as a:ruby structure
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
			paragraphs.push(createParagraph([createRun(line, textStyle)]));
		});

		if (paragraphs.length === 0) {
			paragraphs.push(createParagraph([createRun('', textStyle)]));
		}

		return paragraphs;
	}
}
