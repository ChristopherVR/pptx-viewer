import type {
	PptxElement,
	PptxSlide,
	PptxSlideLayout,
	PptxSlideMaster,
	XmlObject,
} from '../../types';
import { PptxSlideRelationshipRegistry, PptxShapeIdValidator } from '../builders';
import type { IPptxSlideRelationshipRegistry, PptxSaveState } from '../builders';
import type { PptxSaveConstants } from '../factories';
import { getAuxiliaryMasterUnparsedNodes } from './auxiliary-master-node-cache';
import { masterPartElementsChanged } from './master-part-element-signature';
import type { MasterPartRootTag } from './master-part-tags';
import type { SaveSlideContext, SlideShapeCollectors } from './PptxHandlerRuntimeSaveElementWriter';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSlideLayout';
import { SpTreeChildOrderTracker } from './slide-save-xml-order';
import { orderedTemplatePartXml, rememberTemplateSpTreePositions } from './template-sp-tree-order';

const shapeIdValidator = new PptxShapeIdValidator();

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Persist Slide Master view edits to every master and layout the caller
	 * handed back, then let the pipeline's passthrough flush emit them.
	 *
	 * Only parts whose element list actually differs from what the loader
	 * parsed are rewritten. Every binding passes the whole `slideMasters`
	 * array on every save, and masters otherwise round-trip verbatim, so
	 * rebuilding an untouched shape tree from the typed model would trade the
	 * package's fidelity for nothing.
	 */
	protected async applySlideMasterElementChanges(
		masters: PptxSlideMaster[] | undefined,
		layouts: PptxSlideLayout[] | undefined,
		saveSession: PptxSaveState,
		constants: PptxSaveConstants,
	): Promise<void> {
		for (const master of masters ?? []) {
			await this.applyMasterPartElements(
				master.path,
				'p:sldMaster',
				this.masterXmlMap.get(master.path),
				master.elements,
				saveSession,
				constants,
			);
			for (const layout of master.layouts ?? []) {
				await this.applyLayoutPartElements(layout, saveSession, constants);
			}
		}
		for (const layout of layouts ?? []) {
			await this.applyLayoutPartElements(layout, saveSession, constants);
		}
	}

	private async applyLayoutPartElements(
		layout: PptxSlideLayout,
		saveSession: PptxSaveState,
		constants: PptxSaveConstants,
	): Promise<void> {
		await this.applyMasterPartElements(
			layout.path,
			'p:sldLayout',
			this.layoutXmlMap.get(layout.path),
			layout.elements,
			saveSession,
			constants,
		);
	}

	private async applyMasterPartElements(
		partPath: string,
		rootTag: 'p:sldMaster' | 'p:sldLayout',
		data: XmlObject | undefined,
		elements: PptxElement[] | undefined,
		saveSession: PptxSaveState,
		constants: PptxSaveConstants,
	): Promise<void> {
		if (!data || !masterPartElementsChanged(this, partPath, elements)) {
			return;
		}
		try {
			await this.applyAuxiliaryMasterElementChanges(
				partPath,
				rootTag,
				data,
				elements,
				saveSession,
				constants,
			);
		} catch (e) {
			console.warn(`Failed to apply master-view element changes for ${partPath}:`, e);
		}
	}

	/** Rewrite a master/layout shape tree from its typed element collection. */
	protected async applyAuxiliaryMasterElementChanges(
		partPath: string,
		rootTag: MasterPartRootTag,
		data: XmlObject,
		elements: PptxElement[] | undefined,
		saveSession: PptxSaveState,
		constants: PptxSaveConstants,
	): Promise<void> {
		if (elements === undefined) {
			return;
		}
		const root = data[rootTag] as XmlObject | undefined;
		const cSld = root?.['p:cSld'] as XmlObject | undefined;
		const spTree = cSld?.['p:spTree'] as XmlObject | undefined;
		if (!spTree) {
			return;
		}

		const relsPath = this.getAuxiliaryMasterRelsPath(partPath);
		const relsData = await this.loadAuxiliaryMasterRels(relsPath, constants);
		const relsRoot = relsData['Relationships'] as XmlObject;
		const relationships = this.ensureArray(relsRoot['Relationship']) as XmlObject[];
		const relationshipRegistry: IPptxSlideRelationshipRegistry = new PptxSlideRelationshipRegistry({
			relationships,
		});

		const collectors = this.createMasterCollectors();
		const slide: PptxSlide = {
			id: partPath,
			rId: '',
			slideNumber: 0,
			elements,
		};
		const ctx: SaveSlideContext = {
			slide,
			slideRelationships: relationships,
			slideRelationshipRegistry: relationshipRegistry,
			resolveHyperlinkRelationshipId: (target) =>
				relationshipRegistry.resolveHyperlinkRelationshipId(target),
			getSlideRelationshipMap: () => relationshipRegistry.toRelationshipMap(),
			resolvedMediaBytes: new Map(),
			saveSession,
			slideImageRelationshipType: constants.slideImageRelationshipType,
			slideMediaRelationshipType: constants.slideMediaRelationshipType,
			slideVideoRelationshipType: constants.slideVideoRelationshipType,
			slideAudioRelationshipType: constants.slideAudioRelationshipType,
		};

		// `p:spTree` is an ordered sequence and document order IS paint order,
		// but the collectors below are one array per tag. Stamp each emitted
		// node with the position of the element that produced it, exactly as
		// the slide writer does, and hand the stamps to the flush so the tree
		// is re-interleaved on a CLONE rather than in the cached part map.
		const childOrder = new SpTreeChildOrderTracker(collectors);
		for (const element of elements) {
			this.processSlideElement(element, collectors, ctx);
			childOrder.capture();
		}
		this.publishMasterCollectors(partPath, spTree, collectors);
		this.reapplyAlternateContentEnvelopes(spTree, collectors);
		shapeIdValidator.validateAndDeduplicateIds(spTree, (value) => this.ensureArray(value));
		rememberTemplateSpTreePositions(this, partPath, spTree, (node) => childOrder.positionOf(node));

		relsRoot['Relationship'] = relationships;
		relsData['Relationships'] = relsRoot;
		this.zip.file(relsPath, this.builder.build(relsData));
	}

	/**
	 * A template part (layout, slide master, notes master, handout master)
	 * ready to serialize, with its shape tree back in document order.
	 *
	 * Both routes into the ZIP lose that order otherwise: a rewritten tree
	 * comes out of the tag-keyed collectors above, and an untouched one comes
	 * straight out of the parsed object, where fast-xml-parser has already
	 * bucketed same-tag siblings. Document order is paint order, so either way
	 * the deck's furniture silently restacks.
	 *
	 * `sourceXml` is the part as it was loaded, the only surviving record of
	 * the authored sequence when the tree was not rebuilt. Callers that have
	 * already read it pass it in; the rest let it be read back out of the ZIP,
	 * which still holds the original at this point because the flush that
	 * overwrites it is the caller.
	 */
	protected async withTemplateSpTreeOrder(
		partPath: string,
		xmlObj: XmlObject,
		rootTag: MasterPartRootTag,
		sourceXml?: string,
	): Promise<XmlObject> {
		return orderedTemplatePartXml({
			runtime: this,
			partPath,
			xmlObj,
			rootTag,
			sourceXml: sourceXml ?? (await this.zip.file(partPath)?.async('string')),
			getLocalName: (key) => this.compatibilityService.getXmlLocalName(key),
		});
	}

	private getAuxiliaryMasterRelsPath(partPath: string): string {
		const slash = partPath.lastIndexOf('/');
		return `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`;
	}

	private async loadAuxiliaryMasterRels(
		relsPath: string,
		constants: PptxSaveConstants,
	): Promise<XmlObject> {
		const xml = await this.zip.file(relsPath)?.async('string');
		if (xml) {
			return this.parser.parse(xml) as XmlObject;
		}
		return {
			Relationships: {
				'@_xmlns': constants.relationshipsNamespace,
				Relationship: [],
			},
		};
	}

	private createMasterCollectors(): SlideShapeCollectors {
		return {
			shapes: [],
			pics: [],
			connectors: [],
			graphicFrames: [],
			groups: [],
			model3ds: [],
			contentParts: [],
			zooms: [],
		};
	}

	private publishMasterCollectors(
		partPath: string,
		spTree: XmlObject,
		collectors: SlideShapeCollectors,
	): void {
		const buckets: Array<[string, XmlObject[]]> = [
			['p:sp', collectors.shapes],
			['p:pic', collectors.pics],
			['p:cxnSp', collectors.connectors],
			['p:graphicFrame', collectors.graphicFrames],
			['p:grpSp', collectors.groups],
			['p16:model3D', collectors.model3ds],
			['p:contentPart', collectors.contentParts],
			['pslz:sldZm', collectors.zooms.filter((zoom) => zoom['pslz:sldZmObj'])],
			['psezm:sectionZm', collectors.zooms.filter((zoom) => zoom['psezm:sectionZmObj'])],
			['psuz:summaryZm', collectors.zooms.filter((zoom) => zoom['psuz:summaryZmObj'])],
		];
		const unparsedByTag = getAuxiliaryMasterUnparsedNodes(this, partPath);
		for (const [key, values] of buckets) {
			values.push(...(unparsedByTag?.get(key) ?? []));
			if (values.length > 0) {
				spTree[key] = values;
			} else {
				delete spTree[key];
			}
		}
	}
}
