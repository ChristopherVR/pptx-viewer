import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import {
	PptxCompatibilityService,
	PptxDocumentPropertiesUpdater,
	PptxEditorAnimationService,
	PptxNativeAnimationService,
	PptxAnimationWriteService,
	PptxSlideLoaderService,
	PptxSlideTransitionService,
	PptxTemplateBackgroundService,
	PptxXmlLookupService,
} from '../../services';
import type {
	IPptxCompatibilityService,
	IPptxEditorAnimationService,
	IPptxNativeAnimationService,
	IPptxAnimationWriteService,
	IPptxSlideLoaderService,
	IPptxSlideTransitionService,
	IPptxTemplateBackgroundService,
	IPptxXmlLookupService,
} from '../../services';
import { decodeXmlEntities } from '../../utils/xml-entities';

export interface PptxRuntimeDependencyFactoryInput {
	zip: JSZip;
	parser: XMLParser;
	builder: XMLBuilder;
	editorMetaExtensionUri: string;
	editorMetaNamespaceUri: string;
	getXmlLocalName: (xmlKey: string) => string;
}

export interface PptxRuntimeDependencyBundle {
	compatibilityService: IPptxCompatibilityService;
	slideLoaderService: IPptxSlideLoaderService;
	slideTransitionService: IPptxSlideTransitionService;
	editorAnimationService: IPptxEditorAnimationService;
	nativeAnimationService: IPptxNativeAnimationService;
	animationWriteService: IPptxAnimationWriteService;
	templateBackgroundService: IPptxTemplateBackgroundService;
	xmlLookupService: IPptxXmlLookupService;
	documentPropertiesUpdater: PptxDocumentPropertiesUpdater;
}

export interface IPptxRuntimeDependencyFactory {
	createParser: () => XMLParser;
	createBuilder: () => XMLBuilder;
	createDocumentPropertiesUpdater: (
		zip: JSZip,
		parser: XMLParser,
		builder: XMLBuilder,
	) => PptxDocumentPropertiesUpdater;
	createDependencies: (input: PptxRuntimeDependencyFactoryInput) => PptxRuntimeDependencyBundle;
}

export class PptxRuntimeDependencyFactory implements IPptxRuntimeDependencyFactory {
	public createParser(): XMLParser {
		return new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			parseAttributeValue: false,
			// Keep element text as strings. When true (the fast-xml-parser
			// default), `<AppVersion>16.0000</AppVersion>` is coerced to the
			// JS number 16, losing the trailing zeros. On save we write back
			// "16", which fails PowerPoint's strict `[0-9]+\.[0-9]{4}` match
			// on AppVersion: the loader rejects the package with HRESULT
			// 0x80070570 (ERROR_FILE_CORRUPT) and shows the repair dialog.
			// More generally, OOXML element text is always an untyped string;
			// downstream callers coerce where needed.
			parseTagValue: false,
			// Security hardening (Load M3): explicitly disable XML entity
			// processing. PPTX XML never uses DOCTYPE / DTDs, so allowing
			// entity expansion serves only as an attack surface
			// (billion-laughs / external-entity / future fast-xml-parser
			// regressions). v5.5.5 currently defaults to safe behaviour but
			// pinning this makes the guarantee explicit and forward-stable.
			processEntities: false,
			// With entity processing disabled, the five predefined XML entities
			// and numeric character references would survive ENCODED in element
			// text (e.g. `Tom &amp; Jerry` renders the literal `&amp;` and
			// double-encodes to `&amp;amp;` on save). Decode just those here -
			// they cannot trigger entity expansion, so the security guarantee
			// above is preserved - so text nodes hold their real characters and
			// the builder re-encodes them symmetrically on save.
			tagValueProcessor: (_tagName: string, tagValue: string) => decodeXmlEntities(tagValue),
		});
	}

	public createBuilder(): XMLBuilder {
		return new XMLBuilder({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			// Pretty-printing is intentionally disabled. PowerPoint ignores
			// inter-element whitespace in OOXML parts, so indentation buys
			// nothing on read-back but costs measurable serialize time (~2.3s of
			// a ~5.3s save on a 112k-element / 100MB deck) and inflates the
			// pre-compression part size. Emitting compact XML is both faster and
			// smaller with no fidelity loss. See packages/core/scripts/perf-large.ts.
			format: false,
		});
	}

	public createDocumentPropertiesUpdater(
		zip: JSZip,
		parser: XMLParser,
		builder: XMLBuilder,
	): PptxDocumentPropertiesUpdater {
		return new PptxDocumentPropertiesUpdater({
			zip,
			parser,
			builder,
		});
	}

	public createDependencies(input: PptxRuntimeDependencyFactoryInput): PptxRuntimeDependencyBundle {
		const xmlLookupService = new PptxXmlLookupService();
		const compatibilityService = new PptxCompatibilityService();

		return {
			xmlLookupService,
			compatibilityService,
			slideLoaderService: new PptxSlideLoaderService(),
			templateBackgroundService: new PptxTemplateBackgroundService(),
			slideTransitionService: new PptxSlideTransitionService({
				xmlLookupService,
				getXmlLocalName: input.getXmlLocalName,
			}),
			editorAnimationService: new PptxEditorAnimationService({
				xmlLookupService,
				editorMetaExtensionUri: input.editorMetaExtensionUri,
				editorMetaNamespaceUri: input.editorMetaNamespaceUri,
			}),
			nativeAnimationService: new PptxNativeAnimationService(),
			animationWriteService: new PptxAnimationWriteService(),
			documentPropertiesUpdater: this.createDocumentPropertiesUpdater(
				input.zip,
				input.parser,
				input.builder,
			),
		};
	}
}
