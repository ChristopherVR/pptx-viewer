import type { IPptxXmlLookupService } from '../../services';
import type {
	PptxCustomShow,
	PptxHeaderFooter,
	PptxKinsoku,
	PptxModifyVerifier,
	PptxPhotoAlbum,
	PptxPresentationProperties,
	PptxSection,
	XmlObject,
} from '../../types';
import { applyKinsokuToXml } from '../../utils/kinsoku-parser';
import { applyCustomShows, applySections } from '../../utils/presentation-collections';
import type { PptxSlideReferenceRemap } from '../../utils/presentation-collections';

export interface PptxPresentationSaveBuilderOptions {
	headerFooter?: PptxHeaderFooter;
	presentationProperties?: PptxPresentationProperties;
	customShows?: PptxCustomShow[];
	sections?: PptxSection[];
	photoAlbum?: PptxPhotoAlbum;
	kinsoku?: PptxKinsoku | null;
	modifyVerifier?: PptxModifyVerifier | null;
}

export interface PptxPresentationSaveBuildInput {
	presentationData: XmlObject;
	options?: PptxPresentationSaveBuilderOptions;
	rawSlideWidthEmu: number;
	rawSlideHeightEmu: number;
	rawSlideSizeType?: string;
	xmlLookupService: IPptxXmlLookupService;
	/**
	 * Old->new slide-reference remapping from the slides reconciler. Used to
	 * rewrite custom-show relationship ids and section numeric slide ids when
	 * slides were reordered/removed and their ids/rIds were reassigned.
	 */
	slideReferenceRemap?: PptxSlideReferenceRemap;
}

export interface IPptxPresentationSaveBuilder {
	applySaveOptions(init: PptxPresentationSaveBuildInput): XmlObject;
}

export class PptxPresentationSaveBuilder implements IPptxPresentationSaveBuilder {
	public applySaveOptions(init: PptxPresentationSaveBuildInput): XmlObject {
		const rootKey = Object.keys(init.presentationData).find(
			(key) => key.replace(/^.*:/u, '') === 'presentation',
		);
		let presentation = rootKey
			? (init.presentationData[rootKey] as XmlObject | undefined)
			: undefined;
		if (!presentation) {
			return init.presentationData;
		}

		this.applyHeaderFooter(presentation, init.options?.headerFooter);
		this.applySlideDimensions(
			presentation,
			init.rawSlideWidthEmu,
			init.rawSlideHeightEmu,
			init.rawSlideSizeType,
		);
		applyCustomShows(
			presentation,
			init.options?.customShows,
			init.xmlLookupService,
			init.slideReferenceRemap,
		);
		applySections(
			presentation,
			init.options?.sections,
			init.xmlLookupService,
			init.slideReferenceRemap,
		);
		this.applyPhotoAlbum(presentation, init.options?.photoAlbum);
		presentation = this.applyKinsoku(presentation, init.options?.kinsoku);
		this.applyModifyVerifier(presentation, init.options?.modifyVerifier);

		init.presentationData[rootKey ?? 'p:presentation'] = presentation;
		return init.presentationData;
	}

	private applyHeaderFooter(
		presentation: XmlObject,
		_headerFooter: PptxHeaderFooter | undefined,
	): void {
		// `<p:hf>` is not a valid child of `<p:presentation>` per the OOXML
		// schema (ECMA-376 CT_Presentation) — it belongs on slide masters,
		// notes masters, handout masters, and slides. Emitting it here
		// produces `Sch_InvalidElementContentExpectingComplex` and triggers
		// PowerPoint's file-corruption / repair dialog on open.
		//
		// Strip any existing `p:hf` that a prior (broken) save may have left
		// at the presentation root. Header/footer settings applied through
		// the UI are intentionally a no-op at the presentation level until
		// proper slide-master-level support is implemented.
		if (presentation['p:hf'] !== undefined) {
			delete presentation['p:hf'];
		}
	}

	private applySlideDimensions(
		presentation: XmlObject,
		rawSlideWidthEmu: number,
		rawSlideHeightEmu: number,
		rawSlideSizeType?: string,
	): void {
		const slideSize = presentation['p:sldSz'] as XmlObject | undefined;
		if (!slideSize) {
			return;
		}
		if (rawSlideWidthEmu <= 0 && rawSlideHeightEmu <= 0) {
			return;
		}

		if (rawSlideWidthEmu > 0) {
			slideSize['@_cx'] = String(rawSlideWidthEmu);
		}
		if (rawSlideHeightEmu > 0) {
			slideSize['@_cy'] = String(rawSlideHeightEmu);
		}
		if (rawSlideSizeType) {
			slideSize['@_type'] = rawSlideSizeType;
		}

		// Preserve p:notesSz (already present in presentation XML from load)
		// No modification needed — we just ensure it stays in the tree.
	}

	private applyPhotoAlbum(presentation: XmlObject, photoAlbum: PptxPhotoAlbum | undefined): void {
		if (!photoAlbum) {
			return;
		}
		const pa: XmlObject = (presentation['p:photoAlbum'] as XmlObject) || {};

		if (photoAlbum.bw !== undefined) {
			pa['@_bw'] = photoAlbum.bw ? '1' : '0';
		}
		if (photoAlbum.showCaptions !== undefined) {
			pa['@_showCaptions'] = photoAlbum.showCaptions ? '1' : '0';
		}
		if (photoAlbum.layout !== undefined) {
			pa['@_layout'] = photoAlbum.layout;
		}
		if (photoAlbum.frame !== undefined) {
			pa['@_frame'] = photoAlbum.frame;
		}

		presentation['p:photoAlbum'] = pa;
	}

	private applyKinsoku(
		presentation: XmlObject,
		kinsoku: PptxKinsoku | null | undefined,
	): XmlObject {
		return applyKinsokuToXml(presentation, kinsoku);
	}

	private applyModifyVerifier(
		presentation: XmlObject,
		modifyVerifier: PptxModifyVerifier | null | undefined,
	): void {
		// null means explicitly remove the verifier
		if (modifyVerifier === null) {
			delete presentation['p:modifyVerifier'];
			return;
		}
		// undefined means no change — preserve whatever is in the XML tree
		if (!modifyVerifier) {
			return;
		}

		const mv: XmlObject = {};
		if (modifyVerifier.algorithmName !== undefined) {
			mv['@_algorithmName'] = modifyVerifier.algorithmName;
		}
		if (modifyVerifier.hashData !== undefined) {
			mv['@_hashData'] = modifyVerifier.hashData;
		}
		if (modifyVerifier.saltData !== undefined) {
			mv['@_saltData'] = modifyVerifier.saltData;
		}
		if (modifyVerifier.spinValue !== undefined) {
			mv['@_spinValue'] = String(modifyVerifier.spinValue);
		}
		if (modifyVerifier.algIdExt !== undefined) {
			mv['@_algIdExt'] = modifyVerifier.algIdExt;
		}
		if (modifyVerifier.cryptAlgorithmSid !== undefined) {
			mv['@_cryptAlgorithmSid'] = String(modifyVerifier.cryptAlgorithmSid);
		}
		if (modifyVerifier.cryptAlgorithmType !== undefined) {
			mv['@_cryptAlgorithmType'] = modifyVerifier.cryptAlgorithmType;
		}
		if (modifyVerifier.cryptProvider !== undefined) {
			mv['@_cryptProvider'] = modifyVerifier.cryptProvider;
		}
		if (modifyVerifier.cryptProviderType !== undefined) {
			mv['@_cryptProviderType'] = modifyVerifier.cryptProviderType;
		}
		if (modifyVerifier.cryptAlgorithmClass !== undefined) {
			mv['@_cryptAlgorithmClass'] = modifyVerifier.cryptAlgorithmClass;
		}
		presentation['p:modifyVerifier'] = mv;
	}
}
