import type { PptxCompatibilityWarning, PptxElement, XmlObject } from '../types';
import { isAlternateContentChoiceSupported } from '../utils/alternate-content';

const PRESENTATION_CHILDREN = new Set([
	'p:sldMasterIdLst',
	'p:notesMasterIdLst',
	'p:handoutMasterIdLst',
	'p:sldIdLst',
	'p:sldSz',
	'p:notesSz',
	'p:smartTags',
	'p:embeddedFontLst',
	'p:custShowLst',
	'p:photoAlbum',
	'p:custDataLst',
	'p:kinsoku',
	'p:defaultTextStyle',
	'p:modifyVerifier',
	'p:extLst',
]);

const SLIDE_CHILDREN = new Set(['p:cSld', 'p:clrMapOvr', 'p:transition', 'p:timing', 'p:extLst']);
const SHAPE_PROPERTY_CHILDREN = new Set([
	'a:xfrm',
	'a:prstGeom',
	'a:custGeom',
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
	'a:grpFill',
	'a:ln',
	'a:effectLst',
	'a:effectDag',
	'a:scene3d',
	'a:sp3d',
	'a:extLst',
]);
const TEXT_BODY_CHILDREN = new Set(['a:bodyPr', 'a:lstStyle', 'a:p']);
const BLIP_FILL_CHILDREN = new Set(['a:blip', 'a:srcRect', 'a:tile', 'a:stretch']);
const BLIP_CHILDREN = new Set([
	'a:alphaBiLevel',
	'a:alphaCeiling',
	'a:alphaFloor',
	'a:alphaInv',
	'a:alphaMod',
	'a:alphaModFix',
	'a:alphaRepl',
	'a:biLevel',
	'a:blur',
	'a:clrChange',
	'a:clrRepl',
	'a:duotone',
	'a:fillOverlay',
	'a:grayscl',
	'a:hsl',
	'a:lum',
	'a:tint',
	'a:extLst',
]);

export interface CompatibilityWarningInput {
	code: string;
	message: string;
	severity?: PptxCompatibilityWarning['severity'];
	scope: PptxCompatibilityWarning['scope'];
	slideId?: string;
	elementId?: string;
	xmlPath?: string;
}

export interface IPptxCompatibilityService {
	resetWarnings(): void;
	getWarnings(): PptxCompatibilityWarning[];
	getXmlLocalName(xmlKey: string): string;
	reportWarning(warning: CompatibilityWarningInput): void;
	inspectPresentationCompatibility(presentationXmlObj?: XmlObject): void;
	inspectSlideCompatibility(slideXmlObj: XmlObject, slidePath: string): void;
	inspectShapeCompatibility(
		spPr: XmlObject | undefined,
		txBody: XmlObject | undefined,
		slideId: string | undefined,
		elementId: string,
	): void;
	inspectPictureCompatibility(
		blipFill: XmlObject | undefined,
		blip: XmlObject | undefined,
		slideId: string,
		elementId: string,
	): void;
	inspectGraphicFrameCompatibility(
		type: PptxElement['type'],
		slideId: string,
		elementId: string,
	): void;
}

export class PptxCompatibilityService implements IPptxCompatibilityService {
	private warnings: PptxCompatibilityWarning[] = [];

	private warningKeys: Set<string> = new Set();

	public resetWarnings(): void {
		this.warnings = [];
		this.warningKeys.clear();
	}

	public getWarnings(): PptxCompatibilityWarning[] {
		return this.warnings.map((warning) => ({ ...warning }));
	}

	public getXmlLocalName(xmlKey: string): string {
		if (!xmlKey) {
			return '';
		}
		const withoutAttributePrefix = xmlKey.startsWith('@_') ? xmlKey.slice(2) : xmlKey;
		const separatorIndex = withoutAttributePrefix.lastIndexOf(':');
		if (separatorIndex < 0) {
			return withoutAttributePrefix;
		}
		return withoutAttributePrefix.slice(separatorIndex + 1);
	}

	public reportWarning(warning: CompatibilityWarningInput): void {
		const warningKey = this.getWarningKey(warning);
		if (this.warningKeys.has(warningKey)) {
			return;
		}
		this.warningKeys.add(warningKey);

		const normalizedWarning: PptxCompatibilityWarning = {
			code: warning.code,
			message: warning.message,
			severity: warning.severity || 'warning',
			scope: warning.scope,
			slideId: warning.slideId,
			elementId: warning.elementId,
			xmlPath: warning.xmlPath,
		};

		this.warnings.push(normalizedWarning);

		const scopeToken = normalizedWarning.slideId
			? `slide=${normalizedWarning.slideId}`
			: 'presentation';
		const xmlToken = normalizedWarning.xmlPath ? ` path=${normalizedWarning.xmlPath}` : '';
		const logMessage = `[PptxHandler][${normalizedWarning.severity}] ${normalizedWarning.code} (${scopeToken}) ${normalizedWarning.message}${xmlToken}`;
		if (normalizedWarning.severity === 'info') {
			console.info(logMessage);
		} else {
			console.warn(logMessage);
		}
	}

	public inspectPresentationCompatibility(presentationXmlObj?: XmlObject): void {
		const root = presentationXmlObj?.['p:presentation'] as XmlObject | undefined;
		this.inspectUnexpectedChildren(root, PRESENTATION_CHILDREN, {
			code: 'UNMODELLED_PRESENTATION_MARKUP',
			messagePrefix: 'Presentation markup is preserved but is not exposed by the typed model:',
			scope: 'presentation',
			xmlPath: '/p:presentation',
		});
		this.inspectAlternateContent(presentationXmlObj, 'presentation', undefined, '/p:presentation');
	}

	public inspectSlideCompatibility(slideXmlObj: XmlObject, slidePath: string): void {
		const root = slideXmlObj['p:sld'] as XmlObject | undefined;
		this.inspectUnexpectedChildren(root, SLIDE_CHILDREN, {
			code: 'UNMODELLED_SLIDE_MARKUP',
			messagePrefix: 'Slide markup is preserved but is not exposed by the typed model:',
			scope: 'slide',
			slideId: slidePath,
			xmlPath: '/p:sld',
		});
		this.inspectAlternateContent(slideXmlObj, 'slide', slidePath, '/p:sld');
	}

	public inspectShapeCompatibility(
		spPr: XmlObject | undefined,
		txBody: XmlObject | undefined,
		slideId: string | undefined,
		elementId: string,
	): void {
		this.inspectUnexpectedChildren(spPr, SHAPE_PROPERTY_CHILDREN, {
			code: 'UNMODELLED_SHAPE_PROPERTY',
			messagePrefix: 'Shape property is preserved but not represented in the typed model:',
			scope: 'element',
			slideId,
			elementId,
			xmlPath: '/a:spPr',
		});
		this.inspectUnexpectedChildren(txBody, TEXT_BODY_CHILDREN, {
			code: 'UNMODELLED_TEXT_BODY_MARKUP',
			messagePrefix: 'Text-body markup is preserved but not represented in the typed model:',
			scope: 'element',
			slideId,
			elementId,
			xmlPath: '/a:txBody',
		});
	}

	public inspectPictureCompatibility(
		blipFill: XmlObject | undefined,
		blip: XmlObject | undefined,
		slideId: string,
		elementId: string,
	): void {
		this.inspectUnexpectedChildren(blipFill, BLIP_FILL_CHILDREN, {
			code: 'UNMODELLED_BLIP_FILL_MARKUP',
			messagePrefix: 'Picture fill markup is preserved but not represented in the typed model:',
			scope: 'element',
			slideId,
			elementId,
			xmlPath: '/a:blipFill',
		});
		this.inspectUnexpectedChildren(blip, BLIP_CHILDREN, {
			code: 'UNMODELLED_IMAGE_EFFECT',
			messagePrefix: 'Image effect is preserved but may not render or edit accurately:',
			scope: 'element',
			slideId,
			elementId,
			xmlPath: '/a:blip',
		});
		if (blip?.['@_r:link'] && !blip?.['@_r:embed']) {
			this.reportWarning({
				code: 'EXTERNAL_IMAGE_REFERENCE',
				message: 'The picture uses an external relationship and may be unavailable offline.',
				severity: 'info',
				scope: 'element',
				slideId,
				elementId,
				xmlPath: '/a:blip/@r:link',
			});
		}
	}

	public inspectGraphicFrameCompatibility(
		type: PptxElement['type'],
		slideId: string,
		elementId: string,
	): void {
		const limitations: Partial<Record<PptxElement['type'], [string, string]>> = {
			unknown: [
				'UNSUPPORTED_GRAPHIC_FRAME',
				'The graphic-frame payload is preserved but unsupported.',
			],
			smartArt: [
				'PARTIAL_SMARTART_SUPPORT',
				'SmartArt is parsed and preserved, but some DiagramML behavior is not editable.',
			],
			ole: [
				'PARTIAL_OLE_SUPPORT',
				'The OLE payload is preserved but cannot be rendered or edited.',
			],
			ink: [
				'PARTIAL_INK_SUPPORT',
				'Ink is rendered from decoded traces; unsupported ink properties remain raw XML.',
			],
		};
		const limitation = limitations[type];
		if (limitation) {
			this.reportWarning({
				code: limitation[0],
				message: limitation[1],
				severity: type === 'unknown' ? 'warning' : 'info',
				scope: 'element',
				slideId,
				elementId,
				xmlPath: '/p:graphicFrame/a:graphic/a:graphicData',
			});
		}
	}

	private inspectUnexpectedChildren(
		node: XmlObject | undefined,
		allowed: ReadonlySet<string>,
		context: Omit<CompatibilityWarningInput, 'message'> & { messagePrefix: string },
	): void {
		if (!node) {
			return;
		}
		for (const key of Object.keys(node)) {
			if (key.startsWith('@_') || key === '#text' || allowed.has(key)) {
				continue;
			}
			this.reportWarning({
				...context,
				message: `${context.messagePrefix} ${key}`,
				xmlPath: `${context.xmlPath}/${key}`,
			});
		}
	}

	private inspectAlternateContent(
		node: unknown,
		scope: 'presentation' | 'slide',
		slideId: string | undefined,
		path: string,
	): void {
		if (!node || typeof node !== 'object') {
			return;
		}
		if (Array.isArray(node)) {
			node.forEach((item, index) =>
				this.inspectAlternateContent(item, scope, slideId, `${path}[${index}]`),
			);
			return;
		}
		for (const [key, value] of Object.entries(node as XmlObject)) {
			if (key === 'mc:AlternateContent') {
				const blocks = Array.isArray(value) ? value : [value];
				for (const block of blocks as XmlObject[]) {
					const choices = Array.isArray(block?.['mc:Choice'])
						? (block['mc:Choice'] as XmlObject[])
						: block?.['mc:Choice']
							? [block['mc:Choice'] as XmlObject]
							: [];
					for (const choice of choices) {
						if (!isAlternateContentChoiceSupported(choice)) {
							const requires = String(choice['@_Requires'] || '(missing)');
							this.reportWarning({
								code: 'UNSUPPORTED_ALTERNATE_CONTENT_CHOICE',
								message: `An mc:Choice requiring "${requires}" is not implemented; its fallback is used when available.`,
								severity: block?.['mc:Fallback'] ? 'info' : 'warning',
								scope,
								slideId,
								xmlPath: `${path}/mc:AlternateContent/mc:Choice`,
							});
						}
					}
				}
			}
			this.inspectAlternateContent(value, scope, slideId, `${path}/${key}`);
		}
	}

	private normalizeWarningPath(path: string | undefined): string {
		if (!path) {
			return '';
		}
		return path.replace(/\[\d+\]/g, '[]');
	}

	private getWarningKey(warning: CompatibilityWarningInput): string {
		return [
			warning.code,
			warning.scope,
			warning.slideId || '*',
			warning.elementId || '*',
			this.normalizeWarningPath(warning.xmlPath),
		].join('|');
	}
}
