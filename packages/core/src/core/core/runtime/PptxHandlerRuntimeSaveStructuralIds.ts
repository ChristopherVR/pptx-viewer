import type { PptxSlide, XmlObject } from '../../types';
import { canonicalizePlaceholderTypes } from '../../utils/placeholder-validation';
import { remapElementShapeIds } from '../../utils/shape-ids';
import { PptxShapeIdValidator } from '../builders';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveLegacyPpt';
import {
	applyShapeIdMapToSlide,
	hasStructuralIdDefects,
	prescanStructuralPart,
	spTreeOfPartRoot,
	structuralPartRootTag,
} from './save-structural-id-gate';
import type { StructuralPartRootTag } from './save-structural-id-gate';
import { fingerprintSlide } from './slide-fingerprint';
import { orderedTemplatePartXml } from './template-sp-tree-order';

const shapeIdValidator = new PptxShapeIdValidator();

/**
 * Last-export gate over every slide, layout, master, notes and handout part in
 * the finished ZIP: a part still declaring a non-UInt32 or duplicated
 * `p:cNvPr/@id`, or a mis-cased `p:ph/@type`, is repaired and rewritten;
 * every other part is left byte-identical.
 *
 * This exists because the pipeline deliberately does NOT re-serialize what
 * the user did not touch (`canSkipSlideSave`, the cached layout / master
 * passthrough), so defects that came in with the file would otherwise go
 * back out with it on every save. See `save-structural-id-gate.ts` for the
 * decision helpers.
 */
export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected async repairStructuralIdsBeforeExport(slides: PptxSlide[]): Promise<void> {
		for (const path of Object.keys(this.zip.files)) {
			const rootTag = structuralPartRootTag(path);
			if (rootTag === undefined) {
				continue;
			}
			const xml = await this.zip.file(path)?.async('string');
			if (xml === undefined) {
				continue;
			}
			const scan = prescanStructuralPart(xml);
			if (!scan.suspectIds && !scan.placeholderCasing) {
				continue;
			}
			await this.repairStructuralPart(path, rootTag, xml, scan.suspectIds, slides);
		}
	}

	/** The loader's cached parse of a part, which the live model's `rawXml` nodes belong to. */
	private cachedStructuralPart(path: string): XmlObject | undefined {
		return this.slideMap.get(path) ?? this.layoutXmlMap.get(path) ?? this.masterXmlMap.get(path);
	}

	private async repairStructuralPart(
		path: string,
		rootTag: StructuralPartRootTag,
		xml: string,
		suspectIds: boolean,
		slides: PptxSlide[],
	): Promise<void> {
		// The serialized part still has its `mc:AlternateContent` envelopes, so
		// the precise duplicate check runs on a fresh parse; the cached object
		// has had them consumed at load (CC-4) and would miss the fallback twin.
		const fresh = this.parser.parse(xml) as XmlObject;
		const ensureArray = (value: unknown): unknown[] => this.ensureArray(value);
		const freshTree = spTreeOfPartRoot(fresh[rootTag] as XmlObject | undefined);
		const needsIds =
			suspectIds && freshTree !== undefined && hasStructuralIdDefects(freshTree, ensureArray);

		// Repair the CACHED object where there is one: the live elements' `rawXml`
		// are those very nodes, so the fix reaches the model in place and the next
		// save (edited or not) starts from repaired ids. A defect that lives only
		// in a discarded fallback branch is invisible there, so fall back to the
		// fresh parse.
		const cached = this.cachedStructuralPart(path);
		let target = cached ?? fresh;
		let repair = this.repairPartObject(target, rootTag, needsIds, ensureArray);
		if (repair.reassigned === 0 && repair.casing === 0 && cached !== undefined) {
			target = fresh;
			repair = this.repairPartObject(target, rootTag, needsIds, ensureArray);
		}
		if (repair.reassigned === 0 && repair.casing === 0) {
			return;
		}

		if (repair.ids.size > 0) {
			const slide = slides.find((candidate) => candidate.id === path);
			if (slide) {
				applyShapeIdMapToSlide(slide, repair.ids);
				this.savedSlideFingerprints.set(slide.id, fingerprintSlide(slide));
			}
			const templateElements = this.layoutCache.get(path) ?? this.masterCache.get(path);
			if (templateElements) {
				remapElementShapeIds(templateElements, repair.ids);
			}
		}

		const ordered = orderedTemplatePartXml({
			runtime: this,
			partPath: path,
			xmlObj: target,
			rootTag,
			sourceXml: xml,
			getLocalName: (key) => this.compatibilityService.getXmlLocalName(key),
			alternateContentBlockByRawXml: this.alternateContentBlockByRawXml,
		});
		this.zip.file(path, this.builder.build(ordered));

		if (repair.reassigned > 0) {
			this.compatibilityService.reportWarning({
				code: 'SHAPE_ID_DEDUPLICATED',
				message: `Reassigned ${repair.reassigned} invalid or duplicate shape ID(s) in '${path}'.`,
				scope: 'save',
				slideId: path,
			});
		}
		if (repair.casing > 0) {
			this.compatibilityService.reportWarning({
				code: 'PLACEHOLDER_TYPE_CANONICALIZED',
				message: `Corrected the casing of ${repair.casing} placeholder type(s) in '${path}'.`,
				scope: 'save',
				slideId: path,
			});
		}
	}

	private repairPartObject(
		xmlObj: XmlObject,
		rootTag: StructuralPartRootTag,
		needsIds: boolean,
		ensureArray: (value: unknown) => unknown[],
	): { reassigned: number; ids: Map<string, string>; casing: number } {
		const root = xmlObj[rootTag] as XmlObject | undefined;
		const spTree = spTreeOfPartRoot(root);
		const idRepair =
			needsIds && root !== undefined && spTree !== undefined
				? shapeIdValidator.repairShapeIds(spTree, ensureArray, root)
				: { reassigned: 0, ids: new Map<string, string>() };
		const casing = root === undefined ? 0 : canonicalizePlaceholderTypes(root);
		return { ...idRepair, casing };
	}
}
