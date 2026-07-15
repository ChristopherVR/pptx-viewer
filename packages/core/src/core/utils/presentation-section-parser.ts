import type { IPptxXmlLookupService } from '../services';
import type { PptxSection, XmlObject } from '../types';
import { cloneXmlObject } from './clone-utils';

export interface PptxSectionMap {
	sectionBySlideId: Map<string, { sectionId: string; sectionName: string }>;
	orderedSections: PptxSection[];
}

function findSectionList(
	presentation: XmlObject | undefined,
	lookup: IPptxXmlLookupService,
): XmlObject | undefined {
	const direct = lookup.getChildByLocalName(presentation, 'sectionLst');
	if (direct) {
		return direct;
	}
	const extList = lookup.getChildByLocalName(presentation, 'extLst');
	for (const ext of lookup.getChildrenArrayByLocalName(extList, 'ext')) {
		const candidate = lookup.getChildByLocalName(ext, 'sectionLst');
		if (candidate) {
			return candidate;
		}
	}
	return undefined;
}

function booleanAttribute(value: unknown): boolean | undefined {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	if (normalized === '1' || normalized === 'true') {
		return true;
	}
	if (normalized === '0' || normalized === 'false') {
		return false;
	}
	return undefined;
}

export function extractSectionMap(
	presentationData: XmlObject | null,
	lookup: IPptxXmlLookupService,
): PptxSectionMap {
	const sectionBySlideId = new Map<string, { sectionId: string; sectionName: string }>();
	const orderedSections: PptxSection[] = [];
	const presentation = presentationData
		? lookup.getChildByLocalName(presentationData, 'presentation')
		: undefined;
	const sectionList = findSectionList(presentation, lookup);
	const sections = lookup.getChildrenArrayByLocalName(sectionList, 'section');

	sections.forEach((section, index) => {
		const sectionId = String(section['@_id'] || `section-${index + 1}`);
		const rawName = String(section['@_name'] || '').trim();
		const sectionName = rawName || `Section ${index + 1}`;
		const slideList = lookup.getChildByLocalName(section, 'sldIdLst');
		const slideIds: string[] = [];
		for (const slideEntry of lookup.getChildrenArrayByLocalName(slideList, 'sldId')) {
			const slideId = String(slideEntry['@_id'] || '').trim();
			if (!slideId) {
				continue;
			}
			slideIds.push(slideId);
			sectionBySlideId.set(slideId, { sectionId, sectionName });
		}

		const sectionPr = lookup.getChildByLocalName(section, 'sectionPr');
		const colorRaw = String(sectionPr?.['@_clr'] ?? '').trim();
		orderedSections.push({
			id: sectionId,
			name: sectionName,
			slideIds,
			collapsed: booleanAttribute(sectionPr?.['@_collapsed']),
			color: colorRaw ? (colorRaw.startsWith('#') ? colorRaw : `#${colorRaw}`) : undefined,
			rawXml: cloneXmlObject(section),
		});
	});

	return { sectionBySlideId, orderedSections };
}
