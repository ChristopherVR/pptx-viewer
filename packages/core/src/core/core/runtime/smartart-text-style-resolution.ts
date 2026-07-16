import type { PptxSmartArtTextParagraph, TextStyle, XmlObject } from '../../types';

export type SmartArtRunStyleResolver = (rPr: XmlObject) => TextStyle;

/** Attach the standard shape-text interpretation of each DiagramML run property node. */
export function resolveSmartArtTextStyles(
	paragraphs: PptxSmartArtTextParagraph[] | undefined,
	resolve: SmartArtRunStyleResolver,
): PptxSmartArtTextParagraph[] | undefined {
	for (const paragraph of paragraphs ?? []) {
		if (paragraph.endParaRPr) {
			paragraph.endParaStyle = resolve(paragraph.endParaRPr as XmlObject);
		}
		for (const item of paragraph.items) {
			if (item.kind === 'run' && item.run.rPr) {
				item.run.style = resolve(item.run.rPr as XmlObject);
			} else if ((item.kind === 'field' || item.kind === 'break') && item.rPr) {
				item.style = resolve(item.rPr as XmlObject);
			}
		}
	}
	return paragraphs;
}
