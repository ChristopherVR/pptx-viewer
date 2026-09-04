import { XmlObject, PptxElement } from '../../types';
import type { MediaPptxElement } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSavePresPropsAndSignatures';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected collectMediaElements(elements: PptxElement[], output: MediaPptxElement[]): void {
		for (const element of elements) {
			if (element.type === 'media') {
				output.push(element);
			} else if (element.type === 'group' && Array.isArray(element.children)) {
				this.collectMediaElements(element.children, output);
			}
		}
	}

	protected getShapeIdFromRawXml(rawXml: XmlObject | undefined): string | undefined {
		if (!rawXml) {
			return undefined;
		}
		const cNvPr =
			(rawXml['p:nvSpPr'] as XmlObject | undefined)?.['p:cNvPr'] ||
			(rawXml['p:nvPicPr'] as XmlObject | undefined)?.['p:cNvPr'] ||
			(rawXml['p:nvCxnSpPr'] as XmlObject | undefined)?.['p:cNvPr'] ||
			(rawXml['p:nvGraphicFramePr'] as XmlObject | undefined)?.['p:cNvPr'];
		const rawId = (cNvPr as XmlObject | undefined)?.['@_id'];
		if (rawId === undefined || rawId === null) {
			return undefined;
		}
		const shapeId = String(rawId).trim();
		return shapeId.length > 0 ? shapeId : undefined;
	}

	protected applyMediaTimingToTimingTree(
		node: XmlObject,
		mediaByShapeId: Map<string, MediaPptxElement>,
	): void {
		for (const mediaTag of ['p:video', 'p:audio']) {
			const mediaNodes = this.ensureArray(node[mediaTag]) as XmlObject[];
			mediaNodes.forEach((mediaNode) => {
				const cMediaNode = mediaNode['p:cMediaNode'] as XmlObject | undefined;
				if (!cMediaNode) {
					return;
				}
				const tgtEl = cMediaNode['p:tgtEl'] as XmlObject | undefined;
				const spTgt = tgtEl?.['p:spTgt'] as XmlObject | undefined;
				// `p:subSp/@_spid` names the actual leaf media shape when it sits
				// inside a group (see `PptxAnimationTarget.subShapeId`); `mediaByShapeId`
				// is keyed by each element's OWN id (`collectMediaElements` recurses
				// into group children), so a grouped media shape only matches via the
				// sub-shape id, never the enclosing group's `@_spid`.
				const subSp = spTgt?.['p:subSp'] as XmlObject | undefined;
				const rawShapeId = subSp?.['@_spid'] ?? spTgt?.['@_spid'];
				const shapeId = rawShapeId !== undefined ? String(rawShapeId).trim() : '';
				if (shapeId.length === 0) {
					return;
				}
				const media = mediaByShapeId.get(shapeId);
				if (!media) {
					return;
				}

				let cTn = cMediaNode['p:cTn'] as XmlObject | undefined;
				if (!cTn) {
					cTn = {};
					cMediaNode['p:cTn'] = cTn;
				}

				// G18/G19: `p:cTn` (`CT_TLCommonTimeNodeData`) has no `st`/`end`
				// attributes; a prior version of this writer put trim there, which
				// only round-tripped against this codebase's own (wrong-location)
				// reader, never real PowerPoint. Trim now goes onto the picture's
				// own `p:nvPr/p:extLst/p14:media/p14:trim` (see
				// `writeMediaP14Extension` below), the location PowerPoint uses.

				if (media.loop) {
					cTn['@_repeatCount'] = 'indefinite';
				} else {
					delete cTn['@_repeatCount'];
				}

				// Auto-play: nodeType=1 means "with previous" (auto-start on slide entry)
				if (media.autoPlay) {
					cTn['@_nodeType'] = '1';
				} else {
					delete cTn['@_nodeType'];
				}

				// Play across slides: dur=indefinite means audio timeline spans slides
				if (media.playAcrossSlides && mediaTag === 'p:audio') {
					cTn['@_dur'] = 'indefinite';
				} else if (!media.playAcrossSlides) {
					// Only remove if we're sure it was previously set for play-across
					// Leave dur alone if it was set for other reasons
					if (String(cTn['@_dur']) === 'indefinite') {
						delete cTn['@_dur'];
					}
				}

				if (media.fullScreen) {
					cMediaNode['@_fullScrn'] = '1';
				} else {
					delete cMediaNode['@_fullScrn'];
				}

				// Volume (0-1 → 0-100000)
				if (media.volume !== undefined && Number.isFinite(media.volume)) {
					cMediaNode['@_vol'] = String(Math.round(media.volume * 100000));
				}

				// Hide when not playing → showWhenStopped="0"
				if (media.hideWhenNotPlaying) {
					cMediaNode['@_showWhenStopped'] = '0';
				} else {
					delete cMediaNode['@_showWhenStopped'];
				}

				// G18: trim/fade/speed/bookmarks go onto the PICTURE's own
				// `p:nvPr/p:extLst` (a sibling of `a:videoFile`/`a:audioFile`), not
				// this timing-tree `mediaNode`'s extLst - see `writeMediaP14Extension`.
				this.writeMediaP14Extension(media);
			});
		}

		const cTn = node['p:cTn'] as XmlObject | undefined;
		if (cTn) {
			const childTnLst = cTn['p:childTnLst'] as XmlObject | undefined;
			if (childTnLst) {
				for (const containerTag of ['p:par', 'p:seq', 'p:excl']) {
					const containerNodes = this.ensureArray(childTnLst[containerTag]) as XmlObject[];
					containerNodes.forEach((containerNode) => {
						this.applyMediaTimingToTimingTree(containerNode, mediaByShapeId);
					});
				}
				this.applyMediaTimingToTimingTree(childTnLst, mediaByShapeId);
			}
		}

		for (const containerTag of ['p:par', 'p:seq', 'p:excl', 'p:tnLst']) {
			const containerNodes = this.ensureArray(node[containerTag]) as XmlObject[];
			containerNodes.forEach((containerNode) => {
				this.applyMediaTimingToTimingTree(containerNode, mediaByShapeId);
			});
		}
	}

	/**
	 * Write trim/fade/speed/bookmarks into the PICTURE's own
	 * `p:nvPicPr/p:nvPr/p:extLst/p:ext[@uri="{DAA4B4D4-...}"]/p14:media`
	 * (G18): real PowerPoint writes this extension as a sibling of the
	 * `a:videoFile`/`a:audioFile` reference on the shape's own non-visual
	 * properties, never on the animation timing tree's `p:video`/`p:audio`
	 * node (that location only ever round-tripped against this codebase's own
	 * prior writer, never real PowerPoint XML).
	 *
	 * `media.rawXml` is the same object graph the element writer serialises
	 * (`PptxHandlerRuntimeSaveElementWriter.processSlideElement` uses
	 * `el.rawXml` directly, uncloned, as the `<p:pic>` shape it emits), so
	 * mutating its `nvPr` here reaches the final XML. A media element with no
	 * `rawXml` (freshly inserted via the SDK in the same session, never yet
	 * round-tripped through a load) has no `nvPr` to attach to and is skipped;
	 * its trim/fade/bookmarks are written correctly starting from its next
	 * load, once the SDK-built shape's `rawXml` exists.
	 */
	protected writeMediaP14Extension(media: MediaPptxElement): void {
		const rawXml = media.rawXml as XmlObject | undefined;
		const nvPr = (rawXml?.['p:nvPicPr'] as XmlObject | undefined)?.['p:nvPr'] as
			| XmlObject
			| undefined;
		if (!nvPr) {
			return;
		}

		const hasTrim = media.trimStartMs !== undefined || media.trimEndMs !== undefined;
		const hasFade =
			(media.fadeInDuration !== undefined && media.fadeInDuration > 0) ||
			(media.fadeOutDuration !== undefined && media.fadeOutDuration > 0);
		const hasSpeed = media.playbackSpeed !== undefined && media.playbackSpeed !== 1;
		const hasBookmarks = media.bookmarks !== undefined && media.bookmarks.length > 0;
		if (!hasTrim && !hasFade && !hasSpeed && !hasBookmarks) {
			return;
		}

		let extLst = nvPr['p:extLst'] as XmlObject | undefined;
		if (!extLst) {
			extLst = {};
			nvPr['p:extLst'] = extLst;
		}
		const existingExts = Array.isArray(extLst['p:ext'])
			? (extLst['p:ext'] as XmlObject[])
			: extLst['p:ext']
				? [extLst['p:ext'] as XmlObject]
				: [];

		if (hasTrim || hasFade || hasSpeed) {
			// Find or create the p14:media extension (embed fallback rId, trim,
			// fade, speed). Any pre-existing `@_r:embed` on it is left alone: it
			// names a relationship this writer does not own creating.
			let mediaExt = existingExts.find((e) => e['p14:media'] !== undefined);
			if (!mediaExt) {
				mediaExt = { '@_uri': '{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}' };
				existingExts.push(mediaExt);
			}
			let p14Media = mediaExt['p14:media'] as XmlObject | undefined;
			if (!p14Media) {
				p14Media = {};
				mediaExt['p14:media'] = p14Media;
			}
			if (hasTrim) {
				// COM-verified (see PptxHandlerRuntimeMediaParsingUtils.ts):
				// decimal milliseconds, verbatim - `st` absolute from the start,
				// `end` a distance from the clip's END, not an absolute stop.
				const trimObj: XmlObject = {};
				if (media.trimStartMs !== undefined) {
					trimObj['@_st'] = String(media.trimStartMs);
				}
				if (media.trimEndMs !== undefined) {
					trimObj['@_end'] = String(media.trimEndMs);
				}
				p14Media['p14:trim'] = trimObj;
			}
			if (hasFade) {
				const fadeObj: XmlObject = {};
				if (media.fadeInDuration !== undefined && media.fadeInDuration > 0) {
					fadeObj['@_in'] = String(Math.round(media.fadeInDuration * 1000));
				}
				if (media.fadeOutDuration !== undefined && media.fadeOutDuration > 0) {
					fadeObj['@_out'] = String(Math.round(media.fadeOutDuration * 1000));
				}
				p14Media['p14:fade'] = fadeObj;
			}
			// Playback speed: multiplier to OOXML percentage (1x = 100000)
			if (hasSpeed && media.playbackSpeed !== undefined) {
				p14Media['@_spd'] = String(Math.round(media.playbackSpeed * 100000));
			} else {
				delete p14Media['@_spd'];
			}
		}

		if (hasBookmarks && media.bookmarks) {
			let bmkExt = existingExts.find((e) => e['p14:bmkLst'] !== undefined);
			if (!bmkExt) {
				bmkExt = { '@_uri': '{C809E50D-3E49-4677-B9B1-B2B30C8E0B5F}' };
				existingExts.push(bmkExt);
			}
			bmkExt['p14:bmkLst'] = {
				'p14:bmk': media.bookmarks.map((bmk) => ({
					'@_name': bmk.label,
					'@_time': String(Math.round(bmk.time * 1000)),
				})),
			};
		}

		extLst['p:ext'] = existingExts.length === 1 ? existingExts[0] : existingExts;
	}

	protected applyMediaTimingToRawTiming(rawTiming: XmlObject, elements: PptxElement[]): void {
		const mediaElements: MediaPptxElement[] = [];
		this.collectMediaElements(elements, mediaElements);
		if (mediaElements.length === 0) {
			return;
		}

		const mediaByShapeId = new Map<string, MediaPptxElement>();
		mediaElements.forEach((mediaElement) => {
			const shapeId = this.getShapeIdFromRawXml(mediaElement.rawXml as XmlObject | undefined);
			if (!shapeId) {
				return;
			}
			mediaByShapeId.set(shapeId, mediaElement);
		});
		if (mediaByShapeId.size === 0) {
			return;
		}

		this.applyMediaTimingToTimingTree(rawTiming, mediaByShapeId);
	}
}
