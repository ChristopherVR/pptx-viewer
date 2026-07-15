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
		if (!parsedTransition || !slidePath) {
			return parsedTransition;
		}

		const soundAction = parsedTransition.rawSoundAction;
		const startSound = soundAction?.['p:stSnd'] as XmlObject | undefined;
		const soundRId = String(startSound?.['@_r:embed'] || startSound?.['@_r:link'] || '').trim();
		if (soundRId.length === 0) {
			return parsedTransition;
		}

		parsedTransition.soundRId = soundRId;
		const slideRelationships = this.slideRelsMap.get(slidePath);
		const soundTarget = slideRelationships?.get(soundRId);
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
	 * Extract header/footer settings from the presentation XML.
	 * OOXML stores these as p:hf on the slide master or as properties on
	 * p:presentation > p:defaultTextStyle's parent, or on each slide.
	 * We look for the `p:hf` element in the presentation XML.
	 */
	protected extractHeaderFooter(): PptxHeaderFooter | undefined {
		const pres = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		if (!pres) {
			return undefined;
		}

		// Check for p:hf (header-footer) in the presentation or slides
		const hf = pres['p:hf'] as XmlObject | undefined;
		if (!hf) {
			return undefined;
		}

		const result: PptxHeaderFooter = {};

		// @_hdr: show header (boolean as "0"/"1")
		if (hf['@_hdr'] !== undefined) {
			result.hasHeader = String(hf['@_hdr']) !== '0';
		}
		// @_ftr: show footer
		if (hf['@_ftr'] !== undefined) {
			result.hasFooter = String(hf['@_ftr']) !== '0';
		}
		// @_dt: show date/time
		if (hf['@_dt'] !== undefined) {
			result.hasDateTime = String(hf['@_dt']) !== '0';
		}
		// @_sldNum: show slide number
		if (hf['@_sldNum'] !== undefined) {
			result.hasSlideNumber = String(hf['@_sldNum']) !== '0';
		}

		// Attempt to read footer text from presProps or viewPr
		const footerText = hf['@_ftrText'] as string | undefined;
		if (footerText) {
			result.footerText = String(footerText);
		}

		const dtText = hf['@_dtText'] as string | undefined;
		if (dtText) {
			result.dateTimeText = String(dtText);
		}

		// Date format pattern (e.g. "M/d/yyyy")
		const dtFmt = hf['@_dtFmt'] as string | undefined;
		if (dtFmt) {
			result.dateFormat = String(dtFmt);
			result.dateTimeAuto = true;
		}

		return result;
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
}
