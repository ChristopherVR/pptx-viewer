import { reconcileSmartArtTextParagraphs } from '../core/runtime/smartart-text-reconciliation';
import type {
	PptxSmartArtNode,
	PptxSmartArtTextParagraph,
	TextSegment,
	TextStyle,
	XmlObject,
} from '../types';
import {
	parseAlignmentAttr,
	parseBulletInfo,
	parseLineSpacingExactPt,
	parseLineSpacingMultiplier,
	parseParagraphExtraAttributes,
	parseParagraphLevel,
	parseParagraphMargins,
	parseParagraphRtl,
	parseParagraphSpacingPx,
	parseTabStops,
} from './paragraph-properties-parser';
import {
	parseRunFontElements,
	parseRunPropertyAttributes,
	parseRunSolidFillColor,
	parseRunSolidFillColorXml,
} from './text-run-properties-parser';

function child(node: Record<string, unknown> | undefined, name: string): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	const key = Object.keys(node).find((candidate) => candidate.split(':').pop() === name);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function runStyle(rPr: Record<string, unknown> | undefined, fallback: TextStyle): TextStyle {
	const xml = rPr as XmlObject | undefined;
	const color = parseRunSolidFillColor(xml);
	const extLst = child(rPr, 'extLst');
	return {
		...fallback,
		...parseRunPropertyAttributes(xml),
		...parseRunFontElements(xml),
		...(color ? { color: color.startsWith('#') ? color : `#${color}` } : {}),
		...(parseRunSolidFillColorXml(xml) ? { colorXml: parseRunSolidFillColorXml(xml) } : {}),
		...(extLst ? { runPropertiesExtLstXml: extLst } : {}),
		...(xml ? { runPropertiesXml: xml } : {}),
	};
}

function resolvedRunStyle(
	rPr: Record<string, unknown> | undefined,
	resolved: TextStyle | undefined,
	fallback: TextStyle,
): TextStyle {
	return {
		...runStyle(rPr, fallback),
		...resolved,
		...(rPr ? { runPropertiesXml: rPr as XmlObject } : {}),
	};
}

function paragraphStyle(paragraph: PptxSmartArtTextParagraph, fallback: TextStyle): TextStyle {
	const pPr = paragraph.pPr as XmlObject | undefined;
	const align = parseAlignmentAttr(pPr?.['@_algn']);
	const rtl = parseParagraphRtl(pPr);
	const tabStops = parseTabStops(pPr);
	const extLst = child(paragraph.pPr, 'extLst');
	return {
		...fallback,
		...(align ? { align } : {}),
		...parseParagraphMargins(pPr),
		...parseParagraphExtraAttributes(pPr),
		...(rtl !== undefined ? { rtl } : {}),
		...(tabStops ? { tabStops } : {}),
		...(parseParagraphSpacingPx(child(paragraph.pPr, 'spcBef')) !== undefined
			? { paragraphSpacingBefore: parseParagraphSpacingPx(child(paragraph.pPr, 'spcBef')) }
			: {}),
		...(parseParagraphSpacingPx(child(paragraph.pPr, 'spcAft')) !== undefined
			? { paragraphSpacingAfter: parseParagraphSpacingPx(child(paragraph.pPr, 'spcAft')) }
			: {}),
		...(parseLineSpacingMultiplier(child(paragraph.pPr, 'lnSpc')) !== undefined
			? { lineSpacing: parseLineSpacingMultiplier(child(paragraph.pPr, 'lnSpc')) }
			: {}),
		...(parseLineSpacingExactPt(child(paragraph.pPr, 'lnSpc')) !== undefined
			? { lineSpacingExactPt: parseLineSpacingExactPt(child(paragraph.pPr, 'lnSpc')) }
			: {}),
		...(extLst ? { paragraphPropertiesExtLstXml: extLst } : {}),
		...(child(paragraph.pPr, 'defRPr')
			? { paragraphDefaultRunPropertiesXml: child(paragraph.pPr, 'defRPr') }
			: {}),
	};
}

/**
 * Default glyph synthesized for `dgm:bulletEnabled` when a subordinate
 * paragraph carries no explicit `a:buChar`/`a:buAutoNum` of its own. Matches
 * the marker PowerPoint's own "Vertical Bullet List"-family layouts render.
 */
const AUTO_BULLET_CHAR = '•';

function paragraphMetadata(
	paragraph: PptxSmartArtTextParagraph,
	paragraphIndex: number,
	bulletEnabled: boolean,
): Partial<TextSegment> {
	const pPr = paragraph.pPr as XmlObject | undefined;
	const level = parseParagraphLevel(pPr);
	const explicitBullet = parseBulletInfo(pPr, paragraphIndex) ?? undefined;
	// `dgm:presLayoutVars/dgm:bulletEnabled` (CT_BulletEnabled) tells the
	// interpreter to auto-bullet a node's subordinate outline levels even when
	// the paragraph itself declares no bullet markup (real "Vertical Bullet
	// List"-family layoutDefs never write `a:buChar` on their item template -
	// the bulleting is a diagram-level default, not per-paragraph markup). An
	// explicit opinion on the paragraph - including `a:buNone` - always wins;
	// only an outline level >= 1 (the node's own level-0/title line never
	// bullets) with no opinion gets the synthesized marker.
	const bulletInfo =
		explicitBullet ?? (bulletEnabled && (level ?? 0) >= 1 ? { char: AUTO_BULLET_CHAR } : undefined);
	return {
		...(bulletInfo ? { bulletInfo } : {}),
		paragraphLevel: level,
		...(paragraph.endParaRPr ? { endParaRunProperties: paragraph.endParaRPr } : {}),
	};
}

/** Options refining how {@link projectSmartArtNodeText} builds paragraph metadata. */
export interface ProjectSmartArtNodeTextOptions {
	/** `presLayoutVars.bulletEnabled` for the diagram this node belongs to. */
	bulletEnabled?: boolean;
}

/** Project SmartArt paragraphs into the standard renderer text-segment model. */
export function projectSmartArtNodeText(
	node: PptxSmartArtNode,
	fallbackStyle: TextStyle = {},
	options: ProjectSmartArtNodeTextOptions = {},
): TextSegment[] {
	if (!node.paragraphs?.length) {
		return [{ text: node.text, style: fallbackStyle }];
	}
	const paragraphs = reconcileSmartArtTextParagraphs(node.paragraphs, node.text);
	const segments: TextSegment[] = [];
	for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
		const paragraph = paragraphs[paragraphIndex];
		const pStyle = paragraphStyle(paragraph, fallbackStyle);
		const metadata = paragraphMetadata(paragraph, paragraphIndex, options.bulletEnabled ?? false);
		let first = true;
		const push = (segment: TextSegment): void => {
			segments.push(first ? { ...segment, ...metadata } : segment);
			first = false;
		};
		for (const item of paragraph.items) {
			if (item.kind === 'run') {
				push({
					text: item.run.text,
					style: resolvedRunStyle(item.run.rPr, item.run.style, pStyle),
				});
			} else if (item.kind === 'field') {
				push({
					text: item.text,
					style: resolvedRunStyle(item.rPr, item.style, pStyle),
					fieldType: item.fieldType,
					fieldGuid: item.id,
					fieldParagraphPropertiesXml: item.pPr as XmlObject | undefined,
				});
			} else if (item.kind === 'break') {
				push({
					text: '\n',
					style: resolvedRunStyle(item.rPr, item.style, pStyle),
					isLineBreak: true,
					breakRunProperties: item.rPr,
				});
			} else if (item.kind === 'tab') {
				push({ text: '\t', style: pStyle });
			}
		}
		if (first) {
			push({ text: '', style: { ...pStyle, ...paragraph.endParaStyle } });
		}
		if (paragraphIndex < paragraphs.length - 1) {
			segments.push({
				text: '',
				style: { ...pStyle, ...paragraph.endParaStyle },
				isParagraphBreak: true,
			});
		}
	}
	return segments;
}
