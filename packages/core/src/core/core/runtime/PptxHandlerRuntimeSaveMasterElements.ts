import type { PptxElement, PptxSlide, XmlObject } from '../../types';
import { PptxSlideRelationshipRegistry, PptxShapeIdValidator } from '../builders';
import type { IPptxSlideRelationshipRegistry, PptxSaveState } from '../builders';
import type { PptxSaveConstants } from '../factories';
import { getAuxiliaryMasterUnparsedNodes } from './auxiliary-master-node-cache';
import type { SaveSlideContext, SlideShapeCollectors } from './PptxHandlerRuntimeSaveElementWriter';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveSlideLayout';

const shapeIdValidator = new PptxShapeIdValidator();

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Rewrite a notes/handout master shape tree from its typed element collection. */
	protected async applyAuxiliaryMasterElementChanges(
		partPath: string,
		rootTag: 'p:notesMaster' | 'p:handoutMaster',
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

		for (const element of elements) {
			this.processSlideElement(element, collectors, ctx);
		}
		this.publishMasterCollectors(partPath, spTree, collectors);
		this.reapplyAlternateContentEnvelopes(spTree, collectors);
		shapeIdValidator.validateAndDeduplicateIds(spTree, (value) => this.ensureArray(value));

		relsRoot['Relationship'] = relationships;
		relsData['Relationships'] = relsRoot;
		this.zip.file(relsPath, this.builder.build(relsData));
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
