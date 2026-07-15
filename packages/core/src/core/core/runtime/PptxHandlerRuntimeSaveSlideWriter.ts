import { remapEditorAnimationsToShapeIds } from '../../services';
import { XmlObject, PptxSlide } from '../../types';
import type { MediaPptxElement } from '../../types';
import type { AlternateContentBlock } from '../../utils';
import { SHAPE_TREE_ELEMENT_TAGS } from '../../utils';
import { saveSlideSynchronization } from '../../utils/slide-synchronization';
import { buildClrMapOverrideXml } from '../../utils/theme-override-utils';
import { PptxSlideRelationshipRegistry, PptxShapeIdValidator } from '../builders';
import type { PptxSaveState, IPptxSlideRelationshipRegistry } from '../builders';
import type { PptxSaveConstants } from '../factories';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElementWriter';
import type { SlideShapeCollectors, SaveSlideContext } from './PptxHandlerRuntimeSaveElementWriter';
import {
	ensureA16NamespaceOnSlideRoot,
	slideContainsA16Element,
	ensureMathNamespaceOnSlideRoot,
	slideContainsMathElement,
} from './table-structural-ops';

const shapeIdValidator = new PptxShapeIdValidator();

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Process a single slide during save: update slide XML, process elements,
	 * rebuild shape tree, and persist relationships.
	 */
	protected async processSlideForSave(
		slide: PptxSlide,
		saveSession: PptxSaveState,
		constants: PptxSaveConstants,
	): Promise<void> {
		// Skip re-serialization of unmodified slides to prevent spurious diffs
		if (slide.isDirty === false) {
			return;
		}

		const xmlObj = this.slideMap.get(slide.id);
		if (!xmlObj) {
			return;
		}

		const slideNode = (xmlObj['p:sld'] || {}) as XmlObject;
		if (slide.hidden) {
			slideNode['@_show'] = '0';
		} else {
			delete slideNode['@_show'];
		}
		slideNode['p:clrMapOvr'] = buildClrMapOverrideXml(slide.clrMapOverride);

		if (slide.transition !== undefined) {
			const transitionNode = this.buildSlideTransitionXml(slide.transition);
			if (transitionNode) {
				slideNode['p:transition'] = transitionNode;
			} else {
				delete slideNode['p:transition'];
			}
		}
		// Editor animations key their target by the positional `element.id`. On
		// save, rewrite those references to the target shape's native OOXML
		// `p:cNvPr/@id` (minting one for SDK-created shapes) so `p:spTgt/@spid`
		// and the `pptx:editorMeta` extension reference a shape id real
		// PowerPoint can bind, and so `reconcileAnimationTargets` can map them
		// back on the next load. Shapes are stamped with the same id below.
		const shapeIdAnimations =
			slide.animations !== undefined
				? remapEditorAnimationsToShapeIds(
						slide.elements,
						slide.animations,
						this.maxCnvPrId(this.ensureSlideTree(xmlObj)),
					)
				: undefined;
		if (shapeIdAnimations !== undefined) {
			this.applyEditorAnimations(slideNode, shapeIdAnimations);
		}
		if (shapeIdAnimations && shapeIdAnimations.length > 0) {
			// When rawTiming exists, surgical update preserves complex structures
			const generatedTiming = this.animationWriteService.buildTimingXml(
				shapeIdAnimations,
				slide.rawTiming,
			);
			if (generatedTiming) {
				this.applyMediaTimingToRawTiming(generatedTiming, slide.elements);
				slideNode['p:timing'] = generatedTiming;
			} else if (slide.rawTiming) {
				this.applyMediaTimingToRawTiming(slide.rawTiming, slide.elements);
				slideNode['p:timing'] = slide.rawTiming;
			}
		} else if (slide.rawTiming) {
			this.applyMediaTimingToRawTiming(slide.rawTiming, slide.elements);
			slideNode['p:timing'] = slide.rawTiming;
		}
		xmlObj['p:sld'] = slideNode;

		const spTree = this.ensureSlideTree(xmlObj);
		const slideRelsPath = this.toSlideRelsPath(slide.id);
		const slideRelsXml = await this.zip.file(slideRelsPath)?.async('string');
		const slideRelsData: XmlObject = slideRelsXml
			? this.parser.parse(slideRelsXml)
			: {
					Relationships: {
						'@_xmlns': constants.relationshipsNamespace,
						Relationship: [],
					},
				};
		const slideRelsRoot = (slideRelsData['Relationships'] || {}) as XmlObject;
		if (!slideRelsRoot['@_xmlns']) {
			slideRelsRoot['@_xmlns'] = constants.relationshipsNamespace;
		}
		const slideRelationships = this.ensureArray(slideRelsRoot['Relationship']) as XmlObject[];
		const slideRelationshipRegistry: IPptxSlideRelationshipRegistry =
			new PptxSlideRelationshipRegistry({
				relationships: slideRelationships,
			});
		const existingCommentRelationship = slideRelationshipRegistry.removeCommentRelationships(
			constants.slideCommentRelationshipType,
		);
		await saveSlideSynchronization({
			zip: this.zip,
			parser: this.parser,
			writer: this.builder,
			slide,
			relationships: slideRelationships,
			nextRelationshipId: () => slideRelationshipRegistry.nextRelationshipId(),
			relationshipType: constants.slideSyncRelationshipType,
			contentType: constants.slideSyncContentType,
		});

		this.slideBackgroundBuilder.applyBackground({
			slideNode,
			slide,
			zip: this.zip,
			saveState: saveSession,
			relationshipRegistry: slideRelationshipRegistry,
			slideImageRelationshipType: constants.slideImageRelationshipType,
			parseDataUrlToBytes: (dataUrl) => this.parseDataUrlToBytes(dataUrl),
		});

		this.slideCommentPartWriter.writeComments({
			slide,
			saveState: saveSession,
			existingCommentRelationship,
			relationshipRegistry: slideRelationshipRegistry,
			slideCommentRelationshipType: constants.slideCommentRelationshipType,
			zip: this.zip,
			xmlBuilder: this.builder,
			slideCommentsXmlFactory: this.slideCommentsXmlFactory,
			resolvePartPath: (slidePath, relationshipTarget) =>
				this.resolveImagePath(slidePath, relationshipTarget),
			conformance: constants.conformance,
		});

		await this.slideNotesPartUpdater.updateNotesPart({
			slide,
			relationshipRegistry: slideRelationshipRegistry,
			slideNotesRelationshipType: constants.slideNotesRelationshipType,
			zip: this.zip,
			parser: this.parser,
			xmlBuilder: this.builder,
			resolvePartPath: (slidePath, relationshipTarget) =>
				this.resolveImagePath(slidePath, relationshipTarget),
			updateNotesXmlText: (notesXmlObject, notesText, notesSegments) =>
				this.updateNotesXmlText(notesXmlObject, notesText, notesSegments),
			compatibilityReporter: this.compatibilityService,
		});

		// Pre-resolve non-data-URL media sources
		const resolvedMediaBytes = new Map<string, { bytes: Uint8Array; extension: string }>();
		for (const el of slide.elements) {
			if (el.type !== 'media') {
				continue;
			}
			const mediaElement = el as MediaPptxElement;
			if (
				typeof mediaElement.mediaData === 'string' &&
				!mediaElement.mediaData.startsWith('data:')
			) {
				try {
					const resolved = await this.resolveMediaToBytes(mediaElement.mediaData);
					if (resolved) {
						resolvedMediaBytes.set(mediaElement.id, resolved);
					}
				} catch {
					console.warn(`[pptx-save] Failed to resolve media URL for element ${mediaElement.id}`);
				}
			}
		}

		const collectors: SlideShapeCollectors = {
			shapes: [],
			pics: [],
			connectors: [],
			graphicFrames: [],
			groups: [],
			model3ds: [],
			contentParts: [],
		};

		const ctx: SaveSlideContext = {
			slide,
			slideRelationships,
			slideRelationshipRegistry,
			resolveHyperlinkRelationshipId: (target: string) =>
				slideRelationshipRegistry.resolveHyperlinkRelationshipId(target),
			getSlideRelationshipMap: () => slideRelationshipRegistry.toRelationshipMap(),
			resolvedMediaBytes,
			saveSession,
			slideImageRelationshipType: constants.slideImageRelationshipType,
			slideMediaRelationshipType: constants.slideMediaRelationshipType,
			slideVideoRelationshipType: constants.slideVideoRelationshipType,
			slideAudioRelationshipType: constants.slideAudioRelationshipType,
		};

		slide.elements.forEach((el) => {
			this.processSlideElement(el, collectors, ctx);
		});

		// Assign lists back to spTree
		spTree['p:sp'] = collectors.shapes;
		spTree['p:pic'] = collectors.pics;
		spTree['p:cxnSp'] = collectors.connectors;
		spTree['p:graphicFrame'] = collectors.graphicFrames;
		if (collectors.groups.length > 0) {
			spTree['p:grpSp'] = collectors.groups;
		} else {
			delete spTree['p:grpSp'];
		}
		if (collectors.model3ds.length > 0) {
			spTree['p16:model3D'] = collectors.model3ds;
		} else {
			delete spTree['p16:model3D'];
		}
		// `<p:contentPart>` is a direct child of `<p:spTree>` per CT_GroupShape
		// (§19.3.1.42). Stream B Phase 3 routes parsed contentPart elements
		// through their own collector so they no longer end up inside `<p:sp>`.
		if (collectors.contentParts.length > 0) {
			spTree['p:contentPart'] = collectors.contentParts;
		} else {
			delete spTree['p:contentPart'];
		}

		// Re-wrap `<mc:AlternateContent>` envelopes (CC-4).  Parse merged
		// the selected branch's children into the spTree's flat type-arrays;
		// here we lift them back out into their original AC envelope so
		// legacy renderers (older Office, LibreOffice) keep their fallback.
		this.reapplyAlternateContentEnvelopes(spTree, collectors);

		// Validate and deduplicate shape IDs to prevent MS Office corruption
		const reassigned = shapeIdValidator.validateAndDeduplicateIds(spTree, (v) =>
			this.ensureArray(v),
		);
		if (reassigned > 0) {
			this.compatibilityService.reportWarning({
				code: 'SHAPE_ID_DEDUPLICATED',
				message: `Reassigned ${reassigned} duplicate shape ID(s) on slide '${slide.id}'.`,
				scope: 'save',
				slideId: slide.id,
			});
		}

		slideRelsRoot['Relationship'] = slideRelationships;
		slideRelsData['Relationships'] = slideRelsRoot;
		this.zip.file(slideRelsPath, this.builder.build(slideRelsData));

		this.applySlideDrawingGuides(slideNode, slide);
		this.deduplicateExtensionLists(xmlObj);

		// PK-H2: hoist `xmlns:a16` from leaf elements to the slide root and
		// extend `mc:Ignorable` to include `a16`. This keeps Office's
		// "Repair" dialog quiet on round-trip and matches what PowerPoint's
		// own writer emits.
		if (slideContainsA16Element(slideNode)) {
			ensureA16NamespaceOnSlideRoot(slideNode);
		}
		if (slideContainsMathElement(slideNode)) {
			ensureMathNamespaceOnSlideRoot(slideNode);
		}

		this.zip.file(slide.id, this.builder.build(xmlObj));
	}

	/**
	 * Largest `p:cNvPr/@id` already present anywhere in a shape tree, including
	 * the implicit `<p:spTree>` group's own reserved id. Used to seed minting of
	 * fresh animation-target shape ids so they never collide with a reserved id.
	 */
	protected maxCnvPrId(spTree: XmlObject): number {
		let max = 0;
		const nvContainers = [
			'p:nvSpPr',
			'p:nvPicPr',
			'p:nvCxnSpPr',
			'p:nvGraphicFramePr',
			'p:nvGrpSpPr',
		];
		const visit = (node: XmlObject): void => {
			for (const nvKey of nvContainers) {
				const nv = node[nvKey] as XmlObject | undefined;
				const cNvPr = nv?.['p:cNvPr'] as XmlObject | undefined;
				if (cNvPr?.['@_id'] !== undefined) {
					const n = Number.parseInt(String(cNvPr['@_id']), 10);
					if (Number.isFinite(n) && n > max) {
						max = n;
					}
				}
			}
			for (const listKey of ['p:sp', 'p:pic', 'p:cxnSp', 'p:graphicFrame', 'p:grpSp']) {
				for (const child of this.ensureArray(node[listKey]) as XmlObject[]) {
					visit(child);
				}
			}
		};
		visit(spTree);
		return max;
	}

	/**
	 * Re-wrap selected children with their original `<mc:AlternateContent>`
	 * envelope (CC-4).
	 *
	 * Parsing merged the selected branch (Choice when supported, otherwise
	 * Fallback) into the spTree's tag arrays.  Without re-wrapping, dirty
	 * save would emit flat `<p:sp>`/`<p:pic>` etc. and drop the
	 * `<mc:Fallback>` branch — losing legacy rendering for files originally
	 * authored with newer-namespace features.
	 *
	 * Strategy: for each XmlObject in `collectors.*` that traces back to a
	 * known AC block, group by block and:
	 *   1. Remove the node from its flat collector / spTree array.
	 *   2. Clone the original AC envelope.
	 *   3. Replace the selected branch's `<{tag}>` children with the
	 *      live (possibly edited) nodes from the collectors.
	 *   4. Leave the unselected branch verbatim.
	 *
	 * Final envelopes are appended to `spTree['mc:AlternateContent']`.
	 */
	protected reapplyAlternateContentEnvelopes(
		spTree: XmlObject,
		collectors: SlideShapeCollectors,
	): void {
		const TAG_TO_COLLECTOR: Record<string, XmlObject[] | undefined> = {
			'p:sp': collectors.shapes as XmlObject[],
			'p:pic': collectors.pics as XmlObject[],
			'p:cxnSp': collectors.connectors as XmlObject[],
			'p:graphicFrame': collectors.graphicFrames as XmlObject[],
			'p:grpSp': collectors.groups as XmlObject[],
			'p:contentPart': collectors.contentParts as XmlObject[],
			// `model3d` does not flow through SHAPE_TREE_ELEMENT_TAGS, but the
			// AC pathway in OpenXML decks frequently uses Choice = p16:model3D
			// + Fallback = p:pic, so map it for completeness.
			'p16:model3D': collectors.model3ds as XmlObject[],
		};

		// Walk every collected node and find which ones are AC-backed.  Group
		// by block reference so a multi-element AC envelope is rebuilt once.
		const blockGroups = new Map<
			AlternateContentBlock,
			Array<{ tag: string; node: XmlObject; collector: XmlObject[] }>
		>();
		for (const tag of Object.keys(TAG_TO_COLLECTOR)) {
			const collector = TAG_TO_COLLECTOR[tag];
			if (!collector) {
				continue;
			}
			for (const node of collector) {
				const block = this.alternateContentBlockByRawXml.get(node);
				if (!block) {
					continue;
				}
				let entries = blockGroups.get(block);
				if (!entries) {
					entries = [];
					blockGroups.set(block, entries);
				}
				entries.push({ tag, node, collector });
			}
		}

		if (blockGroups.size === 0) {
			return;
		}

		const envelopes: XmlObject[] = [];

		for (const [block, entries] of blockGroups) {
			// Pull the live nodes out of the flat tag arrays so they aren't
			// double-emitted (once at the top of spTree, once inside the AC).
			for (const entry of entries) {
				const idx = entry.collector.indexOf(entry.node);
				if (idx !== -1) {
					entry.collector.splice(idx, 1);
				}
			}

			// Clone the original AC envelope (shallow per branch — we don't
			// touch the Fallback's internals).
			const clonedAc: XmlObject = { ...block.rawAc };

			// Group live entries by tag for branch reassembly.
			const liveByTag = new Map<string, XmlObject[]>();
			for (const entry of entries) {
				let arr = liveByTag.get(entry.tag);
				if (!arr) {
					arr = [];
					liveByTag.set(entry.tag, arr);
				}
				arr.push(entry.node);
			}

			if (block.selectedBranch === 'choice') {
				const choices = this.ensureArray(clonedAc['mc:Choice']) as XmlObject[];
				const targetIdx = block.choiceIndex ?? 0;
				const original = choices[targetIdx];
				if (original) {
					const rebuilt: XmlObject = { ...original };
					// Strip every shape-tree tag from the original branch — we
					// replace them entirely with the live nodes (which carry
					// any user edits).  Non-element keys (`@_Requires`,
					// extension lists, etc.) are preserved.
					for (const tag of SHAPE_TREE_ELEMENT_TAGS) {
						delete rebuilt[tag];
					}
					for (const [tag, nodes] of liveByTag) {
						rebuilt[tag] = nodes.length === 1 ? nodes[0] : nodes;
					}
					choices[targetIdx] = rebuilt;
					clonedAc['mc:Choice'] = choices.length === 1 ? choices[0] : choices;
				}
			} else {
				// Fallback was the rendered branch — rebuild it analogously.
				const fallback = clonedAc['mc:Fallback'] as XmlObject | undefined;
				if (fallback) {
					const rebuilt: XmlObject = { ...fallback };
					for (const tag of SHAPE_TREE_ELEMENT_TAGS) {
						delete rebuilt[tag];
					}
					for (const [tag, nodes] of liveByTag) {
						rebuilt[tag] = nodes.length === 1 ? nodes[0] : nodes;
					}
					clonedAc['mc:Fallback'] = rebuilt;
				}
			}

			envelopes.push(clonedAc);
		}

		// Re-publish the now-trimmed collectors back onto the spTree.
		spTree['p:sp'] = collectors.shapes;
		spTree['p:pic'] = collectors.pics;
		spTree['p:cxnSp'] = collectors.connectors;
		spTree['p:graphicFrame'] = collectors.graphicFrames;
		if (collectors.groups.length > 0) {
			spTree['p:grpSp'] = collectors.groups;
		} else {
			delete spTree['p:grpSp'];
		}
		if (collectors.contentParts.length > 0) {
			spTree['p:contentPart'] = collectors.contentParts;
		} else {
			delete spTree['p:contentPart'];
		}
		if (collectors.model3ds.length > 0) {
			spTree['p16:model3D'] = collectors.model3ds;
		} else {
			delete spTree['p16:model3D'];
		}

		// Append the rebuilt envelopes.
		spTree['mc:AlternateContent'] = envelopes.length === 1 ? envelopes[0] : envelopes;
	}
}
