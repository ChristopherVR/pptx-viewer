import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import JSZip from 'jszip';

import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxSlide,
	XmlObject,
} from '../types';
import { applySlideTitlesToAppProps } from '../utils/app-properties-titles';
import { deriveSlideTitles } from '../utils/slide-title';

export interface PptxDocumentPropertiesSaveOptions {
	coreProperties?: PptxCoreProperties;
	appProperties?: PptxAppProperties;
	customProperties?: PptxCustomProperty[];
}

export interface PptxDocumentPropertiesUpdaterContext {
	zip: JSZip;
	parser: XMLParser;
	builder: XMLBuilder;
}

export class PptxDocumentPropertiesUpdater {
	private readonly context: PptxDocumentPropertiesUpdaterContext;

	public constructor(context: PptxDocumentPropertiesUpdaterContext) {
		this.context = context;
	}

	public async updateOnSave(
		slides: PptxSlide[],
		options?: PptxDocumentPropertiesSaveOptions,
	): Promise<void> {
		const nowIso = this.toW3cDate(new Date());

		const coreFile = this.context.zip.file('docProps/core.xml');
		if (coreFile) {
			try {
				const coreXml = await coreFile.async('string');
				const coreData = this.context.parser.parse(coreXml) as XmlObject;
				const coreProps = coreData['cp:coreProperties'] as XmlObject | undefined;
				if (coreProps) {
					this.applyCorePropertiesOverrides(coreProps, options?.coreProperties);
					const currentRevisionRaw = this.extractXmlNodeText(coreProps['cp:revision']);
					const parsedRevision = Number.parseInt(currentRevisionRaw || '', 10);
					const nextRevision =
						Number.isFinite(parsedRevision) && parsedRevision >= 0 ? parsedRevision + 1 : 1;
					coreProps['cp:revision'] = String(nextRevision);

					const modifiedNode = coreProps['dcterms:modified'];
					if (modifiedNode && typeof modifiedNode === 'object' && !Array.isArray(modifiedNode)) {
						const modified = modifiedNode as XmlObject;
						modified['@_xsi:type'] = 'dcterms:W3CDTF';
						modified['#text'] = nowIso;
						coreProps['dcterms:modified'] = modified;
					} else {
						coreProps['dcterms:modified'] = {
							'@_xsi:type': 'dcterms:W3CDTF',
							'#text': nowIso,
						};
					}

					const lastModifiedBy = this.extractXmlNodeText(coreProps['cp:lastModifiedBy']);
					if (!lastModifiedBy) {
						coreProps['cp:lastModifiedBy'] = 'pptx';
					}

					coreData['cp:coreProperties'] = coreProps;
					this.context.zip.file('docProps/core.xml', this.context.builder.build(coreData));
				}
			} catch (error) {
				console.warn('Failed to update core document properties:', error);
			}
		}

		const appFile = this.context.zip.file('docProps/app.xml');
		if (!appFile) {
			return;
		}

		try {
			const appXml = await appFile.async('string');
			const appData = this.context.parser.parse(appXml) as XmlObject;
			const appProps = appData['Properties'] as XmlObject | undefined;
			if (!appProps) {
				return;
			}

			this.applyAppPropertiesOverrides(appProps, options?.appProperties);

			const hiddenSlidesCount = slides.filter((slide) => slide.hidden).length;
			const notesCount = slides.filter((slide) => {
				const notes = String(slide.notes || '').trim();
				return notes.length > 0;
			}).length;

			appProps['Slides'] = String(slides.length);
			appProps['HiddenSlides'] = String(hiddenSlidesCount);
			appProps['Notes'] = String(notesCount);

			this.updateSlideTitleProperties(appProps, slides);

			appData['Properties'] = appProps;
			this.context.zip.file('docProps/app.xml', this.context.builder.build(appData));
		} catch (error) {
			console.warn('Failed to update application document properties:', error);
		}

		await this.updateCustomProperties(options?.customProperties);
	}

	private applyCorePropertiesOverrides(
		coreProps: XmlObject,
		overrides: PptxCoreProperties | undefined,
	): void {
		if (!overrides) {
			return;
		}
		const map: Array<[keyof PptxCoreProperties, string]> = [
			['title', 'dc:title'],
			['subject', 'dc:subject'],
			['creator', 'dc:creator'],
			['keywords', 'cp:keywords'],
			['description', 'dc:description'],
			['lastModifiedBy', 'cp:lastModifiedBy'],
			['revision', 'cp:revision'],
			['created', 'dcterms:created'],
			['modified', 'dcterms:modified'],
			['category', 'cp:category'],
			['contentStatus', 'cp:contentStatus'],
		];
		for (const [sourceKey, xmlKey] of map) {
			const value = overrides[sourceKey];
			if (value === undefined) {
				continue;
			}
			const text = String(value).trim();
			if (text.length === 0) {
				delete coreProps[xmlKey];
			} else if (xmlKey.startsWith('dcterms:')) {
				coreProps[xmlKey] = {
					'@_xsi:type': 'dcterms:W3CDTF',
					'#text': text,
				};
			} else {
				coreProps[xmlKey] = text;
			}
		}
	}

	/**
	 * Recompute `TitlesOfParts` / `HeadingPairs` from the current slide set so
	 * the per-slide title list in `app.xml` stays consistent after slides are
	 * added, removed, or retitled. Delegates the vector rebuild to a pure
	 * helper; here we only derive the ordered titles.
	 */
	private updateSlideTitleProperties(appProps: XmlObject, slides: PptxSlide[]): void {
		applySlideTitlesToAppProps(appProps, deriveSlideTitles(slides));
	}

	private applyAppPropertiesOverrides(
		appProps: XmlObject,
		overrides: PptxAppProperties | undefined,
	): void {
		if (!overrides) {
			return;
		}
		const stringMap: Array<[keyof PptxAppProperties, string]> = [
			['application', 'Application'],
			['appVersion', 'AppVersion'],
			['presentationFormat', 'PresentationFormat'],
			['company', 'Company'],
			['manager', 'Manager'],
			['template', 'Template'],
		];
		const numberMap: Array<[keyof PptxAppProperties, string]> = [
			['slides', 'Slides'],
			['hiddenSlides', 'HiddenSlides'],
			['notes', 'Notes'],
			['totalTime', 'TotalTime'],
			['words', 'Words'],
			['paragraphs', 'Paragraphs'],
		];
		for (const [sourceKey, xmlKey] of stringMap) {
			const value = overrides[sourceKey];
			if (value === undefined) {
				continue;
			}
			const text = String(value).trim();
			if (text.length === 0) {
				delete appProps[xmlKey];
			} else {
				appProps[xmlKey] = text;
			}
		}
		for (const [sourceKey, xmlKey] of numberMap) {
			const value = overrides[sourceKey];
			if (value === undefined) {
				continue;
			}
			const numeric = Number(value);
			if (Number.isFinite(numeric)) {
				appProps[xmlKey] = String(Math.trunc(numeric));
			}
		}
	}

	private async updateCustomProperties(
		customProperties: PptxCustomProperty[] | undefined,
	): Promise<void> {
		if (!customProperties) {
			return;
		}
		const sanitized = customProperties
			.filter((entry) => entry.name.trim().length > 0)
			.map((entry, index) => ({
				...entry,
				pid: index + 2,
			}));
		if (sanitized.length === 0) {
			this.context.zip.remove('docProps/custom.xml');
			await this.removeCustomPropertiesPackagingArtifacts();
			return;
		}
		const customXml: XmlObject = {
			Properties: {
				'@_xmlns': 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties',
				'@_xmlns:vt': 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes',
				property: sanitized.map((entry) => {
					const vtType = this.normalizeCustomPropertyType(entry.type);
					const propertyNode: XmlObject = {
						'@_fmtid': '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}',
						'@_pid': String(entry.pid),
						'@_name': entry.name,
					};
					propertyNode[`vt:${vtType}`] = String(entry.value ?? '');
					return propertyNode;
				}),
			},
		};
		this.context.zip.file('docProps/custom.xml', this.context.builder.build(customXml));
		await this.ensureCustomPropertiesPackagingArtifacts();
	}

	/**
	 * Ensure `[Content_Types].xml` has an `Override` for `docProps/custom.xml`
	 * and the root `_rels/.rels` references it (ECMA-376 §15.2.12.2 +
	 * Part 2 §10.1.2.5). Without these, the package fails OPC validation
	 * and Office strips the custom properties on next save.
	 */
	private async ensureCustomPropertiesPackagingArtifacts(): Promise<void> {
		const customContentType = 'application/vnd.openxmlformats-officedocument.custom-properties+xml';
		const customRelType =
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';

		// 1. [Content_Types].xml — add Override if missing
		const ctFile = this.context.zip.file('[Content_Types].xml');
		if (ctFile) {
			try {
				const ctXml = await ctFile.async('string');
				const ctData = this.context.parser.parse(ctXml) as XmlObject;
				const types = ctData['Types'] as XmlObject | undefined;
				if (types) {
					const overrides = Array.isArray(types['Override'])
						? (types['Override'] as XmlObject[])
						: types['Override']
							? [types['Override'] as XmlObject]
							: [];
					const hasCustomOverride = overrides.some(
						(o) => String(o?.['@_PartName'] || '') === '/docProps/custom.xml',
					);
					if (!hasCustomOverride) {
						overrides.push({
							'@_PartName': '/docProps/custom.xml',
							'@_ContentType': customContentType,
						});
						types['Override'] = overrides.length === 1 ? overrides[0] : overrides;
						this.context.zip.file('[Content_Types].xml', this.context.builder.build(ctData));
					}
				}
			} catch (error) {
				console.warn('Failed to update [Content_Types].xml for custom properties:', error);
			}
		}

		// 2. _rels/.rels — add custom-properties relationship if missing
		const relsFile = this.context.zip.file('_rels/.rels');
		if (relsFile) {
			try {
				const relsXml = await relsFile.async('string');
				const relsData = this.context.parser.parse(relsXml) as XmlObject;
				const relationships = relsData['Relationships'] as XmlObject | undefined;
				if (relationships) {
					const rels = Array.isArray(relationships['Relationship'])
						? (relationships['Relationship'] as XmlObject[])
						: relationships['Relationship']
							? [relationships['Relationship'] as XmlObject]
							: [];
					const hasCustomRel = rels.some((r) => String(r?.['@_Type'] || '') === customRelType);
					if (!hasCustomRel) {
						// Compute next free rId
						let maxId = 0;
						for (const rel of rels) {
							const id = String(rel?.['@_Id'] || '');
							const num = Number.parseInt(id.replace(/^rId/, ''), 10);
							if (Number.isFinite(num) && num > maxId) {
								maxId = num;
							}
						}
						rels.push({
							'@_Id': `rId${maxId + 1}`,
							'@_Type': customRelType,
							'@_Target': 'docProps/custom.xml',
						});
						relationships['Relationship'] = rels;
						this.context.zip.file('_rels/.rels', this.context.builder.build(relsData));
					}
				}
			} catch (error) {
				console.warn('Failed to update _rels/.rels for custom properties:', error);
			}
		}
	}

	/**
	 * Remove the Override + root rel for `docProps/custom.xml` when the
	 * caller has emptied custom properties so the package doesn't keep an
	 * orphan content-type entry referencing a deleted part.
	 */
	private async removeCustomPropertiesPackagingArtifacts(): Promise<void> {
		const customRelType =
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';

		const ctFile = this.context.zip.file('[Content_Types].xml');
		if (ctFile) {
			try {
				const ctXml = await ctFile.async('string');
				const ctData = this.context.parser.parse(ctXml) as XmlObject;
				const types = ctData['Types'] as XmlObject | undefined;
				if (types) {
					const overrides = Array.isArray(types['Override'])
						? (types['Override'] as XmlObject[])
						: types['Override']
							? [types['Override'] as XmlObject]
							: [];
					const filtered = overrides.filter(
						(o) => String(o?.['@_PartName'] || '') !== '/docProps/custom.xml',
					);
					if (filtered.length !== overrides.length) {
						types['Override'] = filtered.length === 1 ? filtered[0] : filtered;
						this.context.zip.file('[Content_Types].xml', this.context.builder.build(ctData));
					}
				}
			} catch {
				/* noop */
			}
		}

		const relsFile = this.context.zip.file('_rels/.rels');
		if (relsFile) {
			try {
				const relsXml = await relsFile.async('string');
				const relsData = this.context.parser.parse(relsXml) as XmlObject;
				const relationships = relsData['Relationships'] as XmlObject | undefined;
				if (relationships) {
					const rels = Array.isArray(relationships['Relationship'])
						? (relationships['Relationship'] as XmlObject[])
						: relationships['Relationship']
							? [relationships['Relationship'] as XmlObject]
							: [];
					const filtered = rels.filter((r) => String(r?.['@_Type'] || '') !== customRelType);
					if (filtered.length !== rels.length) {
						relationships['Relationship'] = filtered;
						this.context.zip.file('_rels/.rels', this.context.builder.build(relsData));
					}
				}
			} catch {
				/* noop */
			}
		}
	}

	private normalizeCustomPropertyType(type: string | undefined): string {
		const supportedTypes = new Set([
			'lpwstr',
			'i4',
			'bool',
			'filetime',
			'r8',
			'i2',
			'ui4',
			'lpstr',
		]);
		const normalized = String(type || 'lpwstr')
			.trim()
			.toLowerCase();
		return supportedTypes.has(normalized) ? normalized : 'lpwstr';
	}

	private extractXmlNodeText(value: unknown): string | undefined {
		if (value === undefined || value === null) {
			return undefined;
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed.length > 0 ? trimmed : undefined;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		if (typeof value === 'object') {
			const candidate = (value as XmlObject)['#text'];
			if (candidate === undefined || candidate === null) {
				return undefined;
			}
			const trimmed = String(candidate).trim();
			return trimmed.length > 0 ? trimmed : undefined;
		}
		return undefined;
	}

	private toW3cDate(date: Date): string {
		return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
	}
}
