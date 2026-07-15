import type {
	PptxCompatibilityWarning,
	PptxElement,
	PptxMediaReferenceKind,
	XmlObject,
} from '../types';
import { inspectAlternateContentWarnings } from './compatibility-alternate-content';
import {
	BLIP_CHILDREN,
	BLIP_FILL_CHILDREN,
	GRAPHIC_FRAME_LIMITATIONS,
	PRESENTATION_CHILDREN,
	SHAPE_PROPERTY_CHILDREN,
	SLIDE_CHILDREN,
	TEXT_BODY_CHILDREN,
} from './compatibility-child-sets';

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
	inspectMediaReferenceCompatibility(
		kind: PptxMediaReferenceKind,
		slideId: string,
		elementId: string,
	): void;
	inspectSlideSynchronizationCompatibility(slideId: string): void;
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
		inspectAlternateContentWarnings(
			presentationXmlObj,
			'presentation',
			undefined,
			'/p:presentation',
			(warning) => this.reportWarning(warning),
		);
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
		inspectAlternateContentWarnings(slideXmlObj, 'slide', slidePath, '/p:sld', (warning) =>
			this.reportWarning(warning),
		);
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
		const limitation = GRAPHIC_FRAME_LIMITATIONS[type as keyof typeof GRAPHIC_FRAME_LIMITATIONS];
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

	public inspectMediaReferenceCompatibility(
		kind: PptxMediaReferenceKind,
		slideId: string,
		elementId: string,
	): void {
		if (kind !== 'audioCd' && kind !== 'quickTimeFile') {
			return;
		}
		this.reportWarning({
			code: kind === 'audioCd' ? 'LEGACY_AUDIO_CD_REFERENCE' : 'LEGACY_QUICKTIME_REFERENCE',
			message:
				kind === 'audioCd'
					? 'Audio CD track metadata is editable and preserved, but playback requires the source disc.'
					: 'QuickTime media is preserved, but browser playback depends on codec support and link availability.',
			severity: 'info',
			scope: 'element',
			slideId,
			elementId,
			xmlPath: `/p:pic/p:nvPicPr/p:nvPr/a:${kind}`,
		});
	}

	public inspectSlideSynchronizationCompatibility(slideId: string): void {
		this.reportWarning({
			code: 'SLIDE_SYNCHRONIZATION_METADATA',
			message:
				'Server slide synchronization metadata is editable and preserved; live server synchronization is not performed.',
			severity: 'info',
			scope: 'slide',
			slideId,
			xmlPath: '/p:sldSyncPr',
		});
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
