import { XmlObject, PptxHeaderFooter } from '../../types';
import type {
	PptxElementAnimation,
	PptxSlideTransition,
	PptxSection,
	PptxModifyVerifier,
	PptxPhotoAlbum,
	PptxKinsoku,
} from '../../types';
import { parseKinsoku as parseKinsokuUtil } from '../../utils/kinsoku-parser';
import { extractSectionMap as parseSectionMap } from '../../utils/presentation-section-parser';
import { readHeaderFooterFromMaster } from './header-footer-parts';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartParsing';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected parseEditorAnimations(
		slideXml: XmlObject | undefined,
	): PptxElementAnimation[] | undefined {
		return this.editorAnimationService.parseEditorAnimations(slideXml);
	}

	protected parseSlideTransition(
		slideXml: XmlObject | undefined,
		slidePath?: string,
	): PptxSlideTransition | undefined {
		const parsedTransition = this.slideTransitionService.parseSlideTransition(slideXml);
		// `parsedTransition.soundRId` is already correctly read off `p:sndAc/p:stSnd/p:snd/@r:embed`
		// by `PptxSlideTransitionService` (via `parseTransitionSound`), which looks at
		// the `p:snd` CHILD element. This used to re-derive the id itself by reading
		// `@_r:embed` directly off `p:stSnd`, one level too high (that attribute lives
		// on its `p:snd` child), so it always read an empty string and bailed out
		// before ever resolving `soundPath`/`soundFileName`: no loaded deck's
		// transition sound ever showed a file name in the ribbon or inspector.
		if (!parsedTransition || !slidePath || !parsedTransition.soundRId) {
			return parsedTransition;
		}

		const slideRelationships = this.slideRelsMap.get(slidePath);
		const soundTarget = slideRelationships?.get(parsedTransition.soundRId);
		if (soundTarget) {
			const soundPath = this.resolveImagePath(slidePath, soundTarget);
			parsedTransition.soundPath = soundPath;
			parsedTransition.soundFileName = soundPath.split('/').pop() || soundPath;
		}

		return parsedTransition;
	}

	protected extractSectionMap(): {
		sectionBySlideId: Map<string, { sectionId: string; sectionName: string }>;
		orderedSections: PptxSection[];
	} {
		return parseSectionMap(this.presentationData, this.xmlLookupService);
	}

	/**
	 * Extract the Header & Footer dialog's state.
	 *
	 * This used to read `p:presentation/p:hf`, an element the OOXML schema
	 * does not allow (CT_Presentation, §19.2.1.26) and that no real deck has
	 * ever contained, so the dialog opened blank for every file. The flags and
	 * the footer/date TEXT actually live on the slide master: `p:hf` for the
	 * former, the master's `ftr` / `dt` / `hdr` placeholder shapes for the
	 * latter. See `header-footer-parts.ts` for the COM evidence.
	 *
	 * The first slide master wins, matching the dialog's presentation-wide
	 * shape. Multi-master decks can disagree; the per-master flags remain
	 * available on `PptxData.slideMasters[n].headerFooter`.
	 */
	protected extractHeaderFooter(): PptxHeaderFooter | undefined {
		const masterRoot = this.firstSlideMasterRoot();
		if (!masterRoot) {
			return undefined;
		}
		const result = readHeaderFooterFromMaster(masterRoot);
		return Object.keys(result).length > 0 ? result : undefined;
	}

	/** The `p:sldMaster` node of the first master, in archive-path order. */
	private firstSlideMasterRoot(): XmlObject | undefined {
		const paths = Array.from(this.masterXmlMap.keys()).sort((a, b) => a.localeCompare(b));
		for (const path of paths) {
			const root = this.masterXmlMap.get(path)?.['p:sldMaster'];
			if (typeof root === 'object' && root !== null) {
				return root as XmlObject;
			}
		}
		return undefined;
	}

	/**
	 * Extract photo album metadata from `p:photoAlbum` in presentation XML.
	 */
	protected extractPhotoAlbum(): PptxPhotoAlbum | undefined {
		const pres = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		if (!pres) {
			return undefined;
		}

		const photoAlbum = pres['p:photoAlbum'] as XmlObject | undefined;
		if (!photoAlbum) {
			return undefined;
		}

		const result: PptxPhotoAlbum = {};
		let hasProps = false;

		const bwRaw = photoAlbum['@_bw'];
		if (bwRaw !== undefined) {
			result.bw = String(bwRaw) === '1' || String(bwRaw) === 'true';
			hasProps = true;
		}

		const showCaptionsRaw = photoAlbum['@_showCaptions'];
		if (showCaptionsRaw !== undefined) {
			result.showCaptions = String(showCaptionsRaw) === '1' || String(showCaptionsRaw) === 'true';
			hasProps = true;
		}

		const layout = photoAlbum['@_layout'];
		if (layout !== undefined) {
			const layoutStr = String(layout).trim();
			if (layoutStr.length > 0) {
				result.layout = layoutStr;
				hasProps = true;
			}
		}

		const frame = photoAlbum['@_frame'];
		if (frame !== undefined) {
			const frameStr = String(frame).trim();
			if (frameStr.length > 0) {
				result.frame = frameStr;
				hasProps = true;
			}
		}

		const isPhotoRaw = photoAlbum['@_isPhoto'];
		if (isPhotoRaw !== undefined) {
			result.isPhoto = String(isPhotoRaw) === '1' || String(isPhotoRaw) === 'true';
			hasProps = true;
		}

		return hasProps ? result : {};
	}

	/**
	 * Extract write-protection verifier from `p:modifyVerifier` in presentation XML.
	 */
	protected extractModifyVerifier(): PptxModifyVerifier | undefined {
		const pres = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		if (!pres) {
			return undefined;
		}

		const mv = pres['p:modifyVerifier'] as XmlObject | undefined;
		if (!mv) {
			return undefined;
		}

		const result: PptxModifyVerifier = {};

		const algorithmName = mv['@_algorithmName'] ?? mv['@_algIdExt'];
		if (algorithmName !== undefined) {
			result.algorithmName = String(algorithmName);
		}

		const hashData = mv['@_hashData'];
		if (hashData !== undefined) {
			result.hashData = String(hashData);
		}

		const saltData = mv['@_saltData'];
		if (saltData !== undefined) {
			result.saltData = String(saltData);
		}

		const spinValue = mv['@_spinValue'] ?? mv['@_spinCount'];
		if (spinValue !== undefined) {
			const parsed = parseInt(String(spinValue), 10);
			if (Number.isFinite(parsed)) {
				result.spinValue = parsed;
			}
		}

		const algIdExt = mv['@_algIdExt'];
		if (algIdExt !== undefined) {
			result.algIdExt = String(algIdExt);
		}

		const cryptAlgorithmSid = mv['@_cryptAlgorithmSid'];
		if (cryptAlgorithmSid !== undefined) {
			const parsed = parseInt(String(cryptAlgorithmSid), 10);
			if (Number.isFinite(parsed)) {
				result.cryptAlgorithmSid = parsed;
			}
		}

		const cryptAlgorithmType = mv['@_cryptAlgorithmType'];
		if (cryptAlgorithmType !== undefined) {
			result.cryptAlgorithmType = String(cryptAlgorithmType);
		}

		const cryptProvider = mv['@_cryptProvider'];
		if (cryptProvider !== undefined) {
			result.cryptProvider = String(cryptProvider);
		}

		const cryptProviderType = mv['@_cryptProviderType'];
		if (cryptProviderType !== undefined) {
			result.cryptProviderType = String(cryptProviderType);
		}

		const cryptAlgorithmClass = mv['@_cryptAlgorithmClass'];
		if (cryptAlgorithmClass !== undefined) {
			result.cryptAlgorithmClass = String(cryptAlgorithmClass);
		}

		return result;
	}

	/**
	 * Extract East Asian line-break settings from `p:kinsoku` in presentation XML.
	 */
	protected extractKinsoku(): PptxKinsoku | undefined {
		return parseKinsokuUtil(this.presentationData ?? undefined);
	}

	/**
	 * Extract `p:presentation/@embedTrueTypeFonts` (ECMA-376 §19.2.1.26).
	 * `undefined` when absent, matching the `@showMasterPhAnim` convention of
	 * never forcing the spec default onto the typed model.
	 */
	protected extractEmbedTrueTypeFonts(): boolean | undefined {
		const pres = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		const raw = pres?.['@_embedTrueTypeFonts'];
		if (raw === undefined) {
			return undefined;
		}
		const lexical = String(raw).trim().toLowerCase();
		return lexical !== '0' && lexical !== 'false';
	}
}
