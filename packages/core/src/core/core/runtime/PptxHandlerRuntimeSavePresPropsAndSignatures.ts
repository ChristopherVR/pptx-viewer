import { XmlObject } from '../../types';
import type { PptxPresentationProperties } from '../../types';
import { safeResolveZipPath } from '../../utils/safe-path';
import { DIGITAL_SIGNATURE_ORIGIN_REL_TYPE } from '../../utils/signature-constants';
import { getSignaturePathsToStrip } from '../../utils/signature-detection';
import { serializePrintProperties, setPresentationPropertiesChild } from './pptx-print-properties';
import { rebuildShowProperties } from './pptx-show-properties';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveDocumentParts';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected async applyPresentationPropertiesPart(
		properties: PptxPresentationProperties | undefined,
	): Promise<void> {
		if (!properties) {
			return;
		}

		const relsXml = await this.zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
		let propsPath = 'ppt/presProps.xml';
		if (relsXml) {
			try {
				const relsData = this.parser.parse(relsXml) as XmlObject;
				const relNodes = this.ensureArray(
					(relsData?.Relationships as XmlObject | undefined)?.Relationship,
				) as XmlObject[];
				const relNode = relNodes.find((node) => {
					const relType = String(node?.['@_Type'] || '');
					const relTarget = String(node?.['@_Target'] || '');
					return relType.includes('presProps') || relTarget.includes('presProps');
				});
				if (relNode) {
					const target = String(relNode['@_Target'] || '').trim();
					if (target.length > 0) {
						const resolved = safeResolveZipPath('ppt', target);
						if (resolved !== null) {
							propsPath = resolved;
						}
						// On rejection, fall back to the safe default 'ppt/presProps.xml'
						// rather than allowing a path-traversal target to overwrite an
						// arbitrary part during save.
					}
				}
			} catch {
				// Fall back to default part path when relationship parsing fails.
			}
		}

		const existingPropsXml = await this.zip.file(propsPath)?.async('string');
		const propsData: XmlObject = existingPropsXml
			? (this.parser.parse(existingPropsXml) as XmlObject)
			: ({
					'p:presentationPr': {
						'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
						'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
					},
				} as XmlObject);

		const rootKey =
			Object.keys(propsData).find((key) => key.replace(/^.*:/u, '') === 'presentationPr') ??
			'p:presentationPr';
		let root = (propsData[rootKey] || {}) as XmlObject;

		// `CT_PresentationProperties` is a fixed sequence
		//   htmlPubPr?, webPr?, prnPr?, showPr?, clrMru?, extLst?
		// and fast-xml-parser serialises keys in insertion order, so every child
		// write has to go through `setPresentationPropertiesChild`. Assigning
		// `root['p:showPr']` by raw key appended it AFTER an existing
		// `p:extLst`, which is Sch_UnexpectedElementContentExpectingComplex.
		const rebuiltShowPr = rebuildShowProperties(
			root['p:showPr'] as XmlObject | undefined,
			properties,
		);
		if (rebuiltShowPr) {
			root = setPresentationPropertiesChild(root, 'showPr', rebuiltShowPr);
		}

		if (properties.printProperties === null) {
			root = setPresentationPropertiesChild(root, 'prnPr', null);
		} else if (properties.printProperties !== undefined) {
			root = setPresentationPropertiesChild(
				root,
				'prnPr',
				serializePrintProperties(properties.printProperties),
			);
		}

		if (properties.mruColors && properties.mruColors.length > 0) {
			root = setPresentationPropertiesChild(root, 'clrMru', {
				'a:srgbClr': properties.mruColors.map((color) => ({
					'@_val': color.replace('#', ''),
				})),
			});
		}

		// NOTE: `p:gridSpacing` does NOT belong under `p:presentationPr`
		// (`presProps.xml`). Real PowerPoint files store it under `p:viewPr`
		// in `ppt/viewProps.xml`; it used to be (incorrectly) written here via
		// a raw key assignment that also bypassed the order-aware
		// `setPresentationPropertiesChild` sequencing used by every other
		// child above. The correct read/write path is
		// `applyViewPropertiesPart` / `buildViewPropertiesXml` in
		// `PptxHandlerRuntimeSaveViewProperties.ts` /
		// `pptx-view-props-helpers.ts`.

		propsData[rootKey] = root;
		this.zip.file(propsPath, this.builder.build(propsData));
	}

	/**
	 * Strip digital signature parts from the ZIP if the document was signed.
	 * Also removes the digital-signature-origin relationship from `_rels/.rels`.
	 */
	protected async stripDigitalSignatures(): Promise<void> {
		if (!this.signatureDetection?.hasSignatures) {
			return;
		}

		const signatureCount = this.signatureDetection.signatureCount;

		// Collect all entry paths
		const entryPaths: string[] = [];
		this.zip.forEach((relativePath) => {
			entryPaths.push(relativePath);
		});

		// Remove all _xmlsignatures/ entries
		const pathsToRemove = getSignaturePathsToStrip(entryPaths);
		for (const sigPath of pathsToRemove) {
			this.zip.remove(sigPath);
		}

		// Remove the digital-signature-origin relationship from _rels/.rels
		const relsXml = await this.zip.file('_rels/.rels')?.async('string');
		if (relsXml) {
			const relsData = this.parser.parse(relsXml) as XmlObject;
			const relsRoot = (relsData?.Relationships ?? {}) as XmlObject;
			const relationships = this.ensureArray(relsRoot.Relationship) as XmlObject[];

			const filtered = relationships.filter(
				(rel) => String(rel?.['@_Type'] || '') !== DIGITAL_SIGNATURE_ORIGIN_REL_TYPE,
			);

			if (filtered.length !== relationships.length) {
				relsRoot.Relationship = filtered;
				relsData.Relationships = relsRoot;
				this.zip.file('_rels/.rels', this.builder.build(relsData));
			}
		}

		// Remove signature content types from [Content_Types].xml
		const ctXml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (ctXml) {
			const ctData = this.parser.parse(ctXml) as XmlObject;
			const typesRoot = (ctData?.Types ?? {}) as XmlObject;
			const overrides = this.ensureArray(typesRoot.Override) as XmlObject[];

			const filteredOverrides = overrides.filter((o) => {
				const partName = String(o?.['@_PartName'] || '');
				return !partName.startsWith('/_xmlsignatures/');
			});

			if (filteredOverrides.length !== overrides.length) {
				typesRoot.Override = filteredOverrides;
				ctData.Types = typesRoot;
				this.zip.file('[Content_Types].xml', this.builder.build(ctData));
			}
		}

		// Surface the strip as a typed save-scope warning so callers can prompt
		// the user or re-sign. Editing any part of a signed OOXML package
		// invalidates every XML-DSig signature, so the parts are removed on
		// save rather than silently left dangling.
		this.compatibilityService.reportWarning({
			code: 'SAVE_SIGNATURES_STRIPPED',
			message:
				signatureCount === 1
					? 'A digital signature was removed on save. Editing a signed presentation invalidates its signature; re-sign the file to restore it.'
					: `${signatureCount} digital signatures were removed on save. Editing a signed presentation invalidates its signatures; re-sign the file to restore them.`,
			severity: 'warning',
			scope: 'save',
		});

		// Clear the detection result after stripping
		this.signatureDetection = null;
	}
}
