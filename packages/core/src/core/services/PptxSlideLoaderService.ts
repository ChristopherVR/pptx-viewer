/**
 * Service responsible for loading and assembling all slides from a PPTX archive.
 *
 * Orchestrates the full slide-loading pipeline: resolving slide paths from the
 * presentation relationship list, parsing each slide's XML, extracting backgrounds,
 * notes, comments, transitions, animations, and enriching SmartArt data.
 *
 * @module PptxSlideLoaderService
 */
import type { PptxSlide, XmlObject } from '../types';
import { parseSlideDrawingGuides } from '../utils/guide-utils';
import { loadSlideSynchronization } from '../utils/slide-synchronization';
import { loadLegacyVmlDrawings } from '../utils/vml-drawing-loader';
import { reconcileAnimationTargets } from './animation-target-reconcile';
import type { IPptxSlideLoaderService, PptxSlideLoaderParams } from './slide-loader-types';

export type {
	PptxMediaTimingEntry,
	PptxMediaTimingMap,
	PptxSlideNotesResult,
	PptxSlideLoaderThemeOverride,
	PptxSlideLoaderParams,
	IPptxSlideLoaderService,
} from './slide-loader-types';

/**
 * Concrete implementation of the slide loader service.
 *
 * Reads the presentation's `p:sldIdLst` to determine slide ordering, then
 * processes each slide sequentially to preserve layout and theme override
 * state across slides.
 */
export class PptxSlideLoaderService implements IPptxSlideLoaderService {
	/**
	 * Load all slides from the PPTX archive in presentation order.
	 *
	 * @param params - Aggregated dependencies and extraction callbacks.
	 * @returns Array of fully assembled {@link PptxSlide} objects.
	 */
	public async loadSlides(params: PptxSlideLoaderParams): Promise<PptxSlide[]> {
		const presentation = params.presentationData['p:presentation'] as XmlObject | undefined;
		const sldIdLst = presentation?.['p:sldIdLst'] as XmlObject | undefined;
		const sldIds = this.toXmlObjectArray(sldIdLst?.['p:sldId']);

		// No slides in this presentation
		if (sldIds.length === 0) {
			params.setOrderedSlidePaths([]);
			return [];
		}

		// Load the presentation-level relationship map (rId -> target path)
		const relsMap = await this.loadPresentationSlideRels(params);

		// Build ordered slide paths by mapping each slide ID's relationship to a file path
		const orderedSlidePaths: string[] = [];
		for (const sldId of sldIds) {
			const sRId = String(sldId['@_r:id'] || '').trim();
			const sTarget = relsMap.get(sRId);
			if (!sTarget) {
				continue;
			}
			const sPath = sTarget.startsWith('/') ? sTarget.substring(1) : `ppt/${sTarget}`;
			orderedSlidePaths.push(sPath);
		}
		params.setOrderedSlidePaths(orderedSlidePaths);

		// Load each slide sequentially (order matters for theme override state)
		const slides: PptxSlide[] = [];
		for (let index = 0; index < sldIds.length; index++) {
			const slide = await this.loadSingleSlide(params, sldIds[index], index, relsMap);
			if (slide) {
				slides.push(slide);
			}
		}

		// Post-process: enrich SmartArt elements with diagram data
		await this.enrichSmartArtData(slides, params);
		// Post-process: enrich chart elements with parsed chart data
		await this.enrichChartData(slides, params);
		return slides;
	}

	/**
	 * Load the presentation-level relationships XML and build a map
	 * from relationship IDs to their target file paths.
	 *
	 * @param params - Loader params providing the zip archive and parser.
	 * @returns Map of relationship ID to target path string.
	 */
	private async loadPresentationSlideRels(
		params: PptxSlideLoaderParams,
	): Promise<Map<string, string>> {
		const relsXml = await params.zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
		if (!relsXml) {
			return new Map<string, string>();
		}

		const relsData = params.parser.parse(relsXml) as XmlObject;
		const relationships = (relsData['Relationships'] as XmlObject | undefined)?.['Relationship'];
		const relNodes = this.toXmlObjectArray(relationships);

		const relsMap = new Map<string, string>();
		for (const relNode of relNodes) {
			const id = String(relNode['@_Id'] || '').trim();
			const target = String(relNode['@_Target'] || '').trim();
			if (id.length === 0 || target.length === 0) {
				continue;
			}
			relsMap.set(id, target);
		}

		return relsMap;
	}

	/**
	 * Load and assemble a single slide from the archive.
	 *
	 * Resolves the slide file path, parses its XML, loads relationships,
	 * applies theme overrides, extracts elements/backgrounds/notes/comments/
	 * transitions/animations, and builds the final {@link PptxSlide} object.
	 *
	 * @param params - Loader params with all extraction callbacks.
	 * @param slideIdNode - The `p:sldId` XML node for this slide.
	 * @param slideIndex - Zero-based index of this slide in presentation order.
	 * @param relsMap - Presentation-level relationship ID to target path map.
	 * @returns The assembled slide, or `undefined` if the slide could not be loaded.
	 */
	private async loadSingleSlide(
		params: PptxSlideLoaderParams,
		slideIdNode: XmlObject,
		slideIndex: number,
		relsMap: Map<string, string>,
	): Promise<PptxSlide | undefined> {
		const rId = String(slideIdNode['@_r:id'] || '').trim();
		if (!rId) {
			return undefined;
		}

		const target = relsMap.get(rId);
		if (!target) {
			return undefined;
		}

		let path = target.startsWith('/') ? target.substring(1) : `ppt/${target}`;
		if (!params.zip.file(path)) {
			path = `ppt/${target}`;
		}

		const slideXmlStr = await params.zip.file(path)?.async('string');
		if (!slideXmlStr) {
			return undefined;
		}

		const slideXmlObj = params.parser.parse(slideXmlStr) as XmlObject;
		params.compatibilityService.inspectSlideCompatibility(slideXmlObj, path);
		params.slideMap.set(path, slideXmlObj);

		const slideId = String(slideIdNode['@_id'] || '').trim();
		const sectionMeta = slideId ? params.sectionBySlideId.get(slideId) : undefined;

		const slideRelsPath = `${path.replace('slides/', 'slides/_rels/')}.rels`;
		await params.loadSlideRelationships(path, slideRelsPath);
		const slideSynchronization = await loadSlideSynchronization({
			zip: params.zip,
			parser: params.parser,
			slidePath: path,
			relsPath: slideRelsPath,
		});
		if (slideSynchronization) {
			params.compatibilityService.inspectSlideSynchronizationCompatibility(path);
		}

		const clrMapOverride = params.parseSlideClrMapOverride(slideXmlObj);
		params.setCurrentSlideClrMapOverride(clrMapOverride);
		// Switch active master state (clrMap + per-master theme) so multi-master
		// decks resolve scheme colours against this slide's own master.
		// Phase 2 Stream B / C-H4.
		await params.setActiveMasterForSlide?.(path);

		// Use try/finally to ensure theme override state is always restored
		let restoreThemeOverride: (() => void) | undefined;
		try {
			// Apply layout-level theme overrides if present
			const layoutPathForOverride = params.findLayoutPathForSlide(path);
			if (layoutPathForOverride) {
				const themeOverride = await params.loadThemeOverride(layoutPathForOverride);
				if (themeOverride) {
					restoreThemeOverride = params.applyThemeOverrideState(themeOverride);
				}
			}

			// Layout parsing seeds placeholder defaults consumed by slide parsing.
			// Keep this ordering even though both operations read different parts.
			const layoutElements = await params.getLayoutElements(path);
			const slideElements = await params.parseSlide(slideXmlObj, path);

			const mediaTimingMap = params.extractMediaTimingMap(slideXmlObj, path);
			await Promise.all([
				mediaTimingMap.size > 0
					? params.enrichMediaElementsWithTiming(slideElements, mediaTimingMap)
					: Promise.resolve(),
				// Recover embedded OLE binaries so callers can download / open the
				// real inner file. Media and OLE elements are disjoint, so both
				// enrichments can safely overlap their archive reads.
				params.enrichOleElementsWithEmbeddedData(slideElements, path),
			]);

			// Merge layout elements (behind) with slide elements (on top)
			const elements = [...layoutElements, ...slideElements];
			const ownBackgroundColor = params.extractBackgroundColor(slideXmlObj);
			const ownBackgroundGradient = params.extractBackgroundGradient(slideXmlObj);
			const [
				backgroundColor,
				backgroundGradient,
				backgroundImage,
				notesResult,
				legacyComments,
				modernComments,
				customerData,
			] = await Promise.all([
				ownBackgroundColor
					? Promise.resolve(ownBackgroundColor)
					: params.getLayoutBackgroundColor(path),
				ownBackgroundGradient
					? Promise.resolve(ownBackgroundGradient)
					: params.getLayoutBackgroundGradient(path),
				(async () => {
					const ownBackgroundImage = await params.extractBackgroundImage(slideXmlObj, path);
					return ownBackgroundImage || params.getLayoutBackgroundImage(path);
				})(),
				params.extractSlideNotes(path),
				params.extractSlideComments(path),
				params.extractModernSlideComments(path),
				params.parseSlideCustomerData(slideXmlObj, path),
			]);

			// Merge modern and legacy comments; prefer separate lists when both exist
			const comments =
				modernComments.length > 0 ? [...legacyComments, ...modernComments] : legacyComments;

			const hidden = params.isSlideHidden(slideXmlObj, slideIdNode);
			const backgroundPattern = params.extractBackgroundPattern(slideXmlObj);
			const backgroundShadeToTitle = params.extractBackgroundShadeToTitle(slideXmlObj);
			const backgroundShowAnimation = params.extractBackgroundShowAnimation(slideXmlObj);
			const showMasterShapes = params.extractShowMasterShapes(slideXmlObj);
			const transition = params.parseSlideTransition(slideXmlObj, path);
			const animations = params.parseEditorAnimations(slideXmlObj);
			const nativeAnimations = params.parseNativeAnimations(slideXmlObj);
			// Reconcile animation shape references (native cNvPr ids in
			// `p:spTgt/@spid`) against the positional `element.id`s assigned on
			// load, and stamp each element's `shapeId`. Without this the animation
			// target ids never match any loaded element id, so nothing animates.
			reconcileAnimationTargets(elements, nativeAnimations, animations);
			const rawTiming = (slideXmlObj['p:sld'] as XmlObject | undefined)?.['p:timing'] as
				| XmlObject
				| undefined;

			const drawingGuides = parseSlideDrawingGuides(slideXmlObj);

			const activeXControls = params.parseSlideActiveXControls(slideXmlObj);

			// Legacy VML drawing parts referenced via a `legacyDrawing` rel are
			// separate `.vml` parts the inline sp-tree parser never sees. Parse
			// them for read-only rendering; the parts round-trip verbatim.
			const legacyVmlElements = await loadLegacyVmlDrawings(
				params.zip,
				params.parser,
				path,
				slideRelsPath,
			);

			return {
				id: path,
				rId,
				slideNumber: slideIndex + 1,
				hidden,
				sectionId: sectionMeta?.sectionId,
				sectionName: sectionMeta?.sectionName,
				elements,
				backgroundColor,
				backgroundGradient: backgroundGradient || undefined,
				backgroundImage,
				transition,
				animations,
				nativeAnimations,
				rawTiming: rawTiming || undefined,
				notes: notesResult.notes,
				notesSegments: notesResult.notesSegments,
				comments,
				modernCommentPart: params.getModernCommentPart?.(path),
				rawXml: slideXmlObj,
				clrMapOverride: clrMapOverride ?? undefined,
				backgroundPattern,
				backgroundShadeToTitle: backgroundShadeToTitle ?? undefined,
				backgroundShowAnimation: backgroundShowAnimation ?? undefined,
				showMasterShapes: showMasterShapes ?? undefined,
				guides: drawingGuides.length > 0 ? drawingGuides : undefined,
				customerData: customerData.length > 0 ? customerData : undefined,
				activeXControls: activeXControls.length > 0 ? activeXControls : undefined,
				legacyVmlElements: legacyVmlElements.length > 0 ? legacyVmlElements : undefined,
				slideSynchronization,
			};
		} finally {
			if (restoreThemeOverride) {
				restoreThemeOverride();
			}
			params.setCurrentSlideClrMapOverride(null);
		}
	}

	/**
	 * Post-process loaded slides to enrich SmartArt elements with diagram data.
	 *
	 * Iterates all elements in all slides, and for any SmartArt element that
	 * lacks diagram data, attempts to resolve it from the graphic frame XML.
	 * Failures are silently caught since SmartArt enrichment is non-critical.
	 *
	 * @param slides - Array of loaded slides to enrich.
	 * @param params - Loader params providing the SmartArt extraction callback.
	 */
	private async enrichSmartArtData(
		slides: PptxSlide[],
		params: PptxSlideLoaderParams,
	): Promise<void> {
		for (const slide of slides) {
			for (const element of slide.elements) {
				if (element.type !== 'smartArt' || element.smartArtData) {
					continue;
				}
				try {
					const smartArtData = await params.getSmartArtDataForGraphicFrame(
						slide.id,
						element.rawXml as XmlObject,
					);
					if (smartArtData) {
						element.smartArtData = smartArtData;
					}
				} catch {
					// Non-critical — SmartArt will render as placeholder if enrichment fails
				}
			}
		}
	}

	/**
	 * Post-process loaded slides to enrich chart elements with parsed data.
	 *
	 * Mirrors {@link enrichSmartArtData}: iterates every element, and for any
	 * chart element that lacks `chartData`, resolves it from the graphic frame
	 * XML via the chart parser. Without this pass a chart loaded from a `.pptx`
	 * has no `chartData`, so every binding renders the neutral "Chart"
	 * placeholder instead of the real chart. Failures are silently caught since
	 * chart enrichment is non-critical (the placeholder remains).
	 *
	 * @param slides - Array of loaded slides to enrich.
	 * @param params - Loader params providing the chart extraction callback.
	 */
	private async enrichChartData(slides: PptxSlide[], params: PptxSlideLoaderParams): Promise<void> {
		for (const slide of slides) {
			for (const element of slide.elements) {
				if (element.type !== 'chart' || element.chartData) {
					continue;
				}
				try {
					const chartData = await params.getChartDataForGraphicFrame(
						slide.id,
						element.rawXml as XmlObject,
					);
					if (chartData) {
						element.chartData = chartData;
					}
				} catch {
					// Non-critical: chart will render as placeholder if enrichment fails
				}
			}
		}
	}

	/**
	 * Normalize a value into an array of XmlObject entries.
	 * Handles the common OOXML pattern where a single child is an object
	 * but multiple children are an array.
	 *
	 * @param value - Raw XML value (object, array, or undefined).
	 * @returns Array of XmlObject entries (may be empty).
	 */
	private toXmlObjectArray(value: unknown): XmlObject[] {
		if (Array.isArray(value)) {
			return value.filter((entry): entry is XmlObject => this.isXmlObject(entry));
		}
		if (this.isXmlObject(value)) {
			return [value];
		}
		return [];
	}

	/**
	 * Type guard to check if a value is a non-null, non-array object (XmlObject).
	 *
	 * @param value - Value to check.
	 * @returns `true` if the value is an XmlObject.
	 */
	private isXmlObject(value: unknown): value is XmlObject {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}
}
