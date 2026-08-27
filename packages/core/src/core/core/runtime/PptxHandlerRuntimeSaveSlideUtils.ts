import { PptxSlide, XmlObject, TextStyle } from '../../types';
import type { PptxElementAnimation, PptxSlideTransition } from '../../types';
import { parseDataUrlToBytes, fetchUrlToBytes } from '../../utils/data-url-utils';
import type { PptxSlideReferenceRemap } from '../../utils/presentation-collections';
import type { PptxSaveState, IPptxSlideRelationshipRegistry } from '../builders';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimePresentationProps';

/** Context {@link PptxHandlerRuntime.embedTransitionSound} needs from the slide save writer. */
export interface EmbedTransitionSoundContext {
	saveSession: PptxSaveState;
	slideRelationshipRegistry: IPptxSlideRelationshipRegistry;
	/** Relationship type for an embedded (package-internal) media part; the
	 * same generic type `processMediaEmbedding` uses for embedded audio/video,
	 * per ECMA-376's convention that type-specific `audio`/`video` relationship
	 * types are reserved for EXTERNALLY linked media. */
	slideMediaRelationshipType: string;
	slideId: string;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected createEmptySlideXml(): XmlObject {
		return {
			'p:sld': {
				'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
				'@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
				'p:cSld': {
					'p:spTree': {
						'p:nvGrpSpPr': {
							'p:cNvPr': { '@_id': '1', '@_name': '' },
							'p:cNvGrpSpPr': {},
							'p:nvPr': {},
						},
						'p:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '0', '@_cy': '0' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '0', '@_cy': '0' },
							},
						},
					},
				},
				'p:clrMapOvr': { 'a:masterClrMapping': {} },
			},
		};
	}

	protected deepCloneXml(value: XmlObject | undefined): XmlObject | undefined {
		if (!value) {
			return undefined;
		}
		try {
			if (typeof structuredClone === 'function') {
				return structuredClone(value) as XmlObject;
			}
			return JSON.parse(JSON.stringify(value)) as XmlObject;
		} catch {
			return undefined;
		}
	}

	protected findSourceSlidePath(requestedSourcePath: string | undefined): string | undefined {
		if (
			requestedSourcePath &&
			this.slideMap.has(requestedSourcePath) &&
			requestedSourcePath.startsWith('ppt/slides/slide')
		) {
			return requestedSourcePath;
		}

		// No explicit source: this is a genuinely new (blank) slide, not a copy
		// of an existing one. Falling back to an arbitrary slide here would
		// silently clone that slide's content and relationships (media, charts,
		// notes) onto a slide the caller never asked to copy.
		return undefined;
	}

	protected async loadSlideRelationships(slidePath: string, relsPath: string): Promise<void> {
		await this.loadPartRelationships(slidePath, relsPath);
	}

	protected async reconcilePresentationSlidesForSave(params: {
		slides: PptxSlide[];
		saveSession: PptxSaveState;
		slideRelationshipType: string;
		slideLayoutRelationshipType: string;
		relationshipsNamespace: string;
	}): Promise<PptxSlideReferenceRemap> {
		return await this.presentationSlidesReconciler.reconcile({
			...params,
			zip: this.zip,
			parser: this.parser,
			xmlBuilder: this.builder,
			presentationData: this.presentationData,
			slideMap: this.slideMap,
			slideRelsMap: this.slideRelsMap,
			toPresentationTarget: (slidePath) => this.toPresentationTarget(slidePath),
			toSlidePathFromTarget: (target) => this.toSlidePathFromTarget(target),
			toSlideRelsPath: (slidePath) => this.toSlideRelsPath(slidePath),
			createEmptySlideXml: () => this.createEmptySlideXml(),
			deepCloneXml: (value) => this.deepCloneXml(value),
			findSourceSlidePath: (sourceSlideId) => this.findSourceSlidePath(sourceSlideId),
			loadSlideRelationships: (slidePath, slideRelsPath) =>
				this.loadSlideRelationships(slidePath, slideRelsPath),
		});
	}

	protected buildSlideTransitionXml(transition: PptxSlideTransition): XmlObject | undefined {
		return this.slideTransitionService.buildSlideTransitionXml(transition);
	}

	/**
	 * Embed a transition sound picked in the UI (`transition.soundData`, a
	 * `data:` URL set by the shared `applyTransitionSoundFile`) as a package
	 * media part and slide relationship, mirroring `processImageEmbedding` /
	 * `processMediaEmbedding` for picture and media elements. Mutates
	 * `transition` in place and must run before {@link buildSlideTransitionXml}
	 * so `buildTransitionSound` sees a real `soundRId`.
	 *
	 * On success, `soundRId`/`soundPath` are set and `soundData` is cleared so
	 * a later save does not re-embed the same bytes (the same "cleared once
	 * embedded" contract `imagePath`/`mediaPath` use). On failure, `soundData`
	 * is cleared and a compatibility warning is reported so a broken payload
	 * cannot loop forever.
	 */
	protected embedTransitionSound(
		transition: PptxSlideTransition,
		ctx: EmbedTransitionSoundContext,
	): void {
		if (typeof transition.soundData !== 'string' || transition.soundData.length === 0) {
			return;
		}
		const parsedSound = this.parseDataUrlToBytes(transition.soundData);
		if (!parsedSound) {
			this.compatibilityService.reportWarning({
				code: 'SAVE_TRANSITION_SOUND_PAYLOAD_UNSUPPORTED',
				message:
					'Transition sound payload could not be converted to an embedded media part and was dropped.',
				scope: 'save',
				slideId: ctx.slideId,
			});
			delete transition.soundData;
			return;
		}
		const targetSoundPath = ctx.saveSession.nextMediaPath(parsedSound.extension, 'audio');
		this.zip.file(targetSoundPath, parsedSound.bytes);
		const relationshipId = ctx.slideRelationshipRegistry.nextRelationshipId();
		ctx.slideRelationshipRegistry.upsertRelationship(
			relationshipId,
			ctx.slideMediaRelationshipType,
			targetSoundPath.replace(/^ppt\//u, '../'),
		);
		transition.soundRId = relationshipId;
		transition.soundPath = targetSoundPath;
		delete transition.soundData;
	}

	protected applyEditorAnimations(slideNode: XmlObject, animations: PptxElementAnimation[]): void {
		this.editorAnimationService.applyEditorAnimations(slideNode, animations);
	}

	protected ensureSlideTree(xmlObj: XmlObject): XmlObject {
		if (!xmlObj['p:sld']) {
			xmlObj['p:sld'] = {};
		}
		// oxlint-disable-next-line eslint/one-var -- preceding `if` blocks merging
		const pSld = xmlObj['p:sld'] as XmlObject;

		if (!pSld['p:cSld']) {
			pSld['p:cSld'] = {};
		}
		// oxlint-disable-next-line eslint/one-var -- preceding `if` blocks merging
		const cSld = pSld['p:cSld'] as XmlObject;

		if (!cSld['p:spTree']) {
			const emptySlide = this.createEmptySlideXml(),
				emptyTree = (
					(emptySlide['p:sld'] as XmlObject | undefined)?.['p:cSld'] as XmlObject | undefined
				)?.['p:spTree'] as XmlObject | undefined;
			if (emptyTree) {
				cSld['p:spTree'] = emptyTree;
			}
		}

		pSld['p:cSld'] = cSld;
		xmlObj['p:sld'] = pSld;
		return cSld['p:spTree'] as XmlObject;
	}

	protected parseDataUrlToBytes(dataUrl: string): { bytes: Uint8Array; extension: string } | null {
		return parseDataUrlToBytes(dataUrl);
	}

	/**
	 * Resolve media data to bytes from any source:
	 * - `data:...;base64,...` — decoded synchronously
	 * - `pptx-resource://...`, `blob:...`, `http(s)://...` — fetched
	 */
	protected async resolveMediaToBytes(
		mediaUrl: string,
	): Promise<{ bytes: Uint8Array; extension: string } | null> {
		// Try base64 data URL first (fast, synchronous)
		const dataResult = parseDataUrlToBytes(mediaUrl);
		if (dataResult) {
			return dataResult;
		}

		// Fall back to fetching the URL (pptx-resource://, blob:, http(s)://)
		return fetchUrlToBytes(mediaUrl);
	}

	protected textAlignToDrawingValue(align: TextStyle['align'] | undefined): string | undefined {
		if (align === 'left') {
			return 'l';
		}
		if (align === 'center') {
			return 'ctr';
		}
		if (align === 'right') {
			return 'r';
		}
		if (align === 'justify') {
			return 'just';
		}
		if (align === 'justLow') {
			return 'justLow';
		}
		if (align === 'dist') {
			return 'dist';
		}
		if (align === 'thaiDist') {
			return 'thaiDist';
		}
		return undefined;
	}

	protected pixelsToPoints(px: number): number {
		return px * (72 / 96);
	}

	protected createParagraphSpacingXmlFromPx(spacing: number | undefined): XmlObject | undefined {
		if (typeof spacing !== 'number' || !Number.isFinite(spacing)) {
			return undefined;
		}
		const spacingPoints = Math.max(0, this.pixelsToPoints(spacing));
		return {
			'a:spcPts': {
				'@_val': String(Math.round(spacingPoints * 100)),
			},
		};
	}

	protected createLineSpacingXmlFromMultiplier(
		lineSpacing: number | undefined,
	): XmlObject | undefined {
		if (typeof lineSpacing !== 'number' || !Number.isFinite(lineSpacing)) {
			return undefined;
		}
		const normalized = Math.max(0.1, Math.min(5, lineSpacing));
		return {
			'a:spcPct': {
				'@_val': String(Math.round(normalized * 100000)),
			},
		};
	}
}
