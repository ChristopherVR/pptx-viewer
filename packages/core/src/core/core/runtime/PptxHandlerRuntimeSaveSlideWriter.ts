import { remapEditorAnimationsToShapeIds } from '../../services';
import { XmlObject, PptxComment, PptxSlide } from '../../types';
import type { MediaPptxElement } from '../../types';
import type { AlternateContentBlock } from '../../utils';
import { applyActiveXControlsToSlide, SHAPE_TREE_ELEMENT_TAGS } from '../../utils';
import { saveModernSlideComments } from '../../utils/modern-comment-package';
import { saveSlideSynchronization } from '../../utils/slide-synchronization';
import { buildClrMapOverrideXml } from '../../utils/theme-override-utils';
import { PptxSlideRelationshipRegistry, PptxShapeIdValidator } from '../builders';
import type { PptxSaveState, IPptxSlideRelationshipRegistry } from '../builders';
import type { PptxSaveConstants } from '../factories';
import { slideBackgroundOrigin } from './authored-slide-background';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveElementWriter';
import type { SlideShapeCollectors, SaveSlideContext } from './PptxHandlerRuntimeSaveElementWriter';
import { fingerprintSlide, slideMatchesFingerprint } from './slide-fingerprint';
import { buildOrderedSlideXml, SpTreeChildOrderTracker } from './slide-save-xml-order';
import { reconcileSlideTransition } from './slide-transition-reconcile';
import {
	ensureA16NamespaceOnSlideRoot,
	slideContainsA16Element,
	ensureMathNamespaceOnSlideRoot,
	slideContainsMathElement,
} from './table-structural-ops';

const shapeIdValidator = new PptxShapeIdValidator();

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected resolveModernCommentAuthorId(comment: PptxComment): string {
		const requestedId = String(comment.authorId || '').trim();
		if (requestedId && this.modernCommentAuthors.has(requestedId)) {
			return requestedId;
		}
		const name = String(comment.author || (requestedId ? `Author ${requestedId}` : 'User')).trim();
		const existing = Array.from(this.modernCommentAuthors.values()).find(
			(author) => author.name === name,
		);
		const id = requestedId || existing?.id || this.createModernCommentAuthorId();
		if (!this.modernCommentAuthors.has(id)) {
			const initials = name
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((token) => token[0].toUpperCase())
				.join('');
			this.modernCommentAuthors.set(id, {
				id,
				name,
				initials: initials || 'U',
				userId: name,
				providerId: 'None',
			});
		}
		comment.authorId = id;
		return id;
	}

	protected nextModernCommentPartPath(): string {
		let index = 1;
		while (this.zip.file(`ppt/comments/modernComment${index}.xml`)) {
			index += 1;
		}
		return `ppt/comments/modernComment${index}.xml`;
	}

	private createModernCommentAuthorId(): string {
		const uuid = globalThis.crypto?.randomUUID?.();
		if (uuid) {
			return `{${uuid.toUpperCase()}}`;
		}
		const suffix = String(this.modernCommentAuthors.size + 1).padStart(12, '0');
		return `{00000000-0000-0000-0000-${suffix}}`;
	}

	/**
	 * Can this slide keep the bytes already in the archive?
	 *
	 * Re-serializing a slide is not free of consequence: the shape tree is
	 * rebuilt from the typed model, so inherited run properties get flattened
	 * into the runs, `mc:AlternateContent` envelopes are re-wrapped, and shape
	 * ids can be renumbered. Doing that to a slide the user never touched is
	 * pure loss, and it used to happen to every slide of every deck on every
	 * save because the `isDirty === false` guard below was never reachable.
	 *
	 * The eligibility rules, in the order they can bite:
	 *
	 * 1. `isDirty === true` is an explicit announcement from a mutation path
	 *    that does not go through the typed model (`applyLayoutToSlide`,
	 *    `merge-operations`), and always wins.
	 * 2. There has to BE something in the archive to keep. A slide created this
	 *    session has no cached XML and no ZIP entry, so it must be written.
	 * 3. Comment-bearing slides are always written. The save session prunes
	 *    every comment part that no slide claimed during this pass, so a
	 *    skipped slide would have its comment part deleted from under it and
	 *    `ppt/commentAuthors.xml` stripped. Everything else the session
	 *    collects (media paths, ink paths, slide numbers) is seeded from the
	 *    ZIP itself and only ever added to, so skipping is safe there.
	 * 4. Otherwise the fingerprint decides: unchanged model, unchanged bytes.
	 */
	private canSkipSlideSave(slide: PptxSlide): boolean {
		if (slide.isDirty === true) {
			return false;
		}
		if (!this.slideMap.has(slide.id) || !this.zip.file(slide.id)) {
			return false;
		}
		if ((slide.comments?.length ?? 0) > 0 || slide.modernCommentPart !== undefined) {
			return false;
		}
		return slide.isDirty === false || slideMatchesFingerprint(this.savedSlideFingerprints, slide);
	}

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
		if (this.canSkipSlideSave(slide)) {
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

		const spTree = this.ensureSlideTree(xmlObj);

		if (slide.transition !== undefined) {
			// `CT_Slide` allows ONE `p:transition`, and PowerPoint 2010+ keeps it
			// inside a slide-root `mc:AlternateContent` envelope whenever it
			// carries p14/p15/p159 markup. Assigning a direct child on top of
			// that envelope emitted the transition up to three times, after
			// `p:timing` and so out of schema sequence too.
			reconcileSlideTransition({
				slideNode,
				transitionNode: this.buildSlideTransitionXml(slide.transition),
				sourceNode: slide.transition.rawTransition,
				getLocalName: (key) => this.compatibilityService.getXmlLocalName(key),
			});
		}
		// Editor animations key their target by the positional `element.id`. On
		// save, rewrite those references to the target shape's native OOXML
		// `p:cNvPr/@id` (minting one for SDK-created shapes) so `p:spTgt/@spid`
		// and the `pptx:editorMeta` extension reference a shape id real
		// PowerPoint can bind, and so `reconcileAnimationTargets` can map them
		// back on the next load. Shapes are stamped with the same id below.
		const shapeIdAnimations =
			slide.animations !== undefined
				? remapEditorAnimationsToShapeIds(slide.elements, slide.animations, this.maxCnvPrId(spTree))
				: undefined;
		if (shapeIdAnimations !== undefined) {
			this.applyEditorAnimations(slideNode, shapeIdAnimations);
		}
		// An EMPTY list must still reach the writer: it is how "the user deleted
		// the last effect" gets to `p:timing`. Gating on a non-empty list left the
		// removed effect in the file forever, still playing in PowerPoint.
		if (shapeIdAnimations !== undefined) {
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

		await this.slideBackgroundBuilder.applyBackground({
			slideNode,
			slide,
			zip: this.zip,
			saveState: saveSession,
			relationshipRegistry: slideRelationshipRegistry,
			slideImageRelationshipType: constants.slideImageRelationshipType,
			authoredBackground: slideBackgroundOrigin(this, slide.id),
			resolveImageToBytes: (url) => this.resolveMediaToBytes(url),
			reportUnsupportedBackground: (imageUrl) =>
				this.compatibilityService.reportWarning({
					code: 'SAVE_BACKGROUND_IMAGE_UNSUPPORTED',
					message: `Slide background image could not be embedded and was preserved as-is or omitted: ${imageUrl.slice(0, 120)}`,
					scope: 'save',
					slideId: slide.id,
				}),
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
		saveModernSlideComments({
			slide,
			zip: this.zip,
			xmlBuilder: this.builder,
			relationships: slideRelationshipRegistry,
			resolveAuthorId: (comment) => this.resolveModernCommentAuthorId(comment),
			emuPerPx: PptxHandlerRuntime.EMU_PER_PX,
			nextPartPath: () => this.nextModernCommentPartPath(),
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
			zooms: [],
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

		// `p:spTree` is an ordered sequence and document order IS paint order, but
		// the collectors below are one array per tag. Stamp each emitted node with
		// the position of the element that produced it so the interleaved order
		// can be restored just before serialization.
		const childOrder = new SpTreeChildOrderTracker(collectors);
		for (const el of slide.elements) {
			this.processSlideElement(el, collectors, ctx);
			childOrder.capture();
		}

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
		if (collectors.zooms.length > 0) {
			spTree['pslz:sldZm'] = collectors.zooms.filter((zoom) => zoom['pslz:sldZmObj']);
			spTree['psezm:sectionZm'] = collectors.zooms.filter((zoom) => zoom['psezm:sectionZmObj']);
			spTree['psuz:summaryZm'] = collectors.zooms.filter((zoom) => zoom['psuz:summaryZmObj']);
		} else {
			delete spTree['pslz:sldZm'];
			delete spTree['psezm:sectionZm'];
			delete spTree['psuz:summaryZm'];
		}

		// Re-wrap `<mc:AlternateContent>` envelopes (CC-4).  Parse merged
		// the selected branch's children into the spTree's flat type-arrays;
		// here we lift them back out into their original AC envelope so
		// legacy renderers (older Office, LibreOffice) keep their fallback.
		this.reapplyAlternateContentEnvelopes(spTree, collectors);
		this.wrapNewContentPartEnvelopes(spTree, collectors.contentParts);
		this.wrapNewModel3DEnvelopes(spTree, collectors.model3ds);
		this.wrapNewZoomEnvelopes(spTree, collectors.zooms);

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

		// Rebuild `<p:controls>` from the typed ActiveX model so control edits
		// (rename, spid retarget, add/remove) round-trip. Undefined means the
		// slide was never parsed for controls, so leave any raw passthrough
		// intact rather than wiping it.
		if (slide.activeXControls !== undefined) {
			applyActiveXControlsToSlide(xmlObj, slide.activeXControls);
		}

		// Serialize through an order-corrected shallow clone: the shape tree is
		// re-interleaved into `slide.elements` order and the slide root is put
		// back into `CT_Slide` sequence. The clone keeps the marker keys out of
		// the cached slide map, so the next save still sees plain tag arrays.
		this.zip.file(
			slide.id,
			this.builder.build(
				buildOrderedSlideXml({
					xmlObj,
					positionOf: (node) => childOrder.positionOf(node),
					getLocalName: (key) => this.compatibilityService.getXmlLocalName(key),
				}),
			),
		);
		// The archive now holds THIS model. Fingerprinting here rather than at
		// the end of `save()` keeps the baseline pinned to the state that
		// actually produced the bytes: anything mutated afterwards is a genuine
		// difference and must be rewritten on the next save.
		this.savedSlideFingerprints.set(slide.id, fingerprintSlide(slide));
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
		for (const node of collectors.zooms) {
			const block = this.alternateContentBlockByRawXml.get(node);
			if (!block) {
				continue;
			}
			const tag = node['psuz:summaryZmObj']
				? 'psuz:summaryZm'
				: node['psezm:sectionZmObj']
					? 'psezm:sectionZm'
					: 'pslz:sldZm';
			let entries = blockGroups.get(block);
			if (!entries) {
				entries = [];
				blockGroups.set(block, entries);
			}
			entries.push({ tag, node, collector: collectors.zooms as XmlObject[] });
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
		if (collectors.zooms.length > 0) {
			spTree['pslz:sldZm'] = collectors.zooms.filter((zoom) => zoom['pslz:sldZmObj']);
			spTree['psezm:sectionZm'] = collectors.zooms.filter((zoom) => zoom['psezm:sectionZmObj']);
			spTree['psuz:summaryZm'] = collectors.zooms.filter((zoom) => zoom['psuz:summaryZmObj']);
		} else {
			delete spTree['pslz:sldZm'];
			delete spTree['psezm:sectionZm'];
			delete spTree['psuz:summaryZm'];
		}

		// Append the rebuilt envelopes.
		spTree['mc:AlternateContent'] = envelopes.length === 1 ? envelopes[0] : envelopes;
	}
}
