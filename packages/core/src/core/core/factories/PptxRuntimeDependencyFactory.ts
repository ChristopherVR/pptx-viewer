import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import {
	annotateCustomGeometryCommandOrder,
	stripXmlOrderMarkers,
} from '../../geometry/custom-geometry-command-order';
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
import {
	decodeXmlEntities,
	encodeXmlAttributeValue,
	encodeXmlTextValue,
} from '../../utils/xml-entities';
import { preservesXmlWhitespace } from '../../utils/xml-whitespace';
import { annotateOmmlSiblingOrder } from '../runtime/omml-sibling-order';
import { annotateParagraphSiblingOrder } from '../runtime/paragraph-sibling-order';
import { annotateSmartArtTextOrder } from '../runtime/smartart-text-order';

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
		const parser = new XMLParser({
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
			// Element text whose schema type is a STRING must survive verbatim.
			// `<a:t>` is the loudest case: PowerPoint frequently splits a
			// sentence across many runs (spell-check, autocorrect), and a word
			// boundary often ends up as its own run whose `<a:t>` is a single
			// space, e.g. `<a:r><a:t> </a:t></a:r>`. fast-xml-parser's default
			// `trimValues: true` trims that whitespace-only text node down to
			// `""`, silently dropping the space and gluing the surrounding
			// words together ("so we immediately start" ->
			// "soweimmediatelystart"). It is not the only case: see
			// utils/xml-whitespace for the full set and the reasoning.
			// Trimming cannot just be turned off wholesale, because with it off
			// the indentation of a pretty-printed part becomes a `#text` node on
			// every container; trimming to `""` is what makes fast-xml-parser
			// drop that node again. So turn it off globally and re-apply it in
			// tagValueProcessor for every tag OUTSIDE that set, which keeps
			// numeric / enum values clean and loses no string content.
			trimValues: false,
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
			tagValueProcessor: (tagName: string, tagValue: string) => {
				const decoded = decodeXmlEntities(tagValue);
				return preservesXmlWhitespace(tagName) ? decoded : decoded.trim();
			},
			// ATTRIBUTE values need exactly the same treatment, and until this
			// existed they got none: `processEntities: false` left every reference
			// encoded, so `name="R&amp;D"` reached the model as the five literal
			// characters `&amp;`, and the builder (whose own `processEntities`
			// defaults to TRUE) then re-escaped that leading `&` on save. That is
			// unbounded COMPOUNDING, not a one-off: every save adds another `amp;`,
			// so an `a:hlinkClick` target of `?a=1&amp;b=2` becomes
			// `?a=1&amp;amp;b=2`, then `&amp;amp;amp;`, and the URL the user follows
			// drifts further from the real one on each round trip. Sixteen committed
			// fixtures already carry `char="&amp;#x2022;"` where PresentationBuilder
			// wrote `&#x2022;`, and text-features.pptx has been through it twice
			// (`&amp;amp;#x2022;`). Attribute values also feed the Selection Pane
			// (`p:cNvPr/@name`), alt text (`@descr`) and layout names
			// (`p:cSld/@name`), which are read from the MODEL, so under-decoding is
			// user-visible even without a save.
			attributeValueProcessor: (_attrName: string, attrValue: string) =>
				decodeXmlEntities(attrValue),
		});
		const parse = parser.parse.bind(parser);
		parser.parse = ((xml: string, validationOption?: boolean | object) => {
			const parsed = validationOption === undefined ? parse(xml) : parse(xml, validationOption);
			if (typeof xml === 'string' && xml.includes('custGeom')) {
				annotateCustomGeometryCommandOrder(xml, parsed);
			}
			if (typeof xml === 'string' && (xml.includes('dataModel') || xml.includes('txBody'))) {
				annotateSmartArtTextOrder(xml, parsed);
			}
			if (typeof xml === 'string' && xml.includes('oMath')) {
				annotateOmmlSiblingOrder(xml, parsed);
			}
			// An `a:fld` / `a:br` interleaved with `a:r` collapses to
			// grouped-by-tag keys, which is how every inline field ended up
			// rendered at the END of its paragraph. The annotator re-checks for
			// mixed content itself, so this gate only skips parts that carry no
			// paragraphs at all.
			if (typeof xml === 'string' && xml.includes('<a:p')) {
				annotateParagraphSiblingOrder(xml, parsed);
			}
			return parsed;
		}) as typeof parser.parse;
		return parser;
	}

	public createBuilder(): XMLBuilder {
		const builder = new XMLBuilder({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
			// fast-xml-parser defaults `suppressBooleanAttributes` to TRUE, which
			// collapses any attribute whose value is literally the string `true`
			// into the HTML-style valueless form: `<p:strVal val="true"/>` is
			// emitted as `<p:strVal val/>`. XML 1.0 has no boolean attributes
			// (AttValue is required by production [41]), so that output is not
			// merely schema-invalid, it is not well-formed, and PowerPoint refuses
			// the whole package with "PowerPoint could not open the file". It hit
			// EVERY part: `p:strVal`/`p:boolVal` animation values, the SharePoint
			// `customXml` itemProps (`ma:hidden="true"`, `ma:readOnly="true"`,
			// `nillable="true"`), and any third-party producer's `xsd:boolean`
			// attributes written in the `true`/`false` lexical form rather than
			// `1`/`0`. Our own writers emit `1`/`0`, so the damage arrived purely
			// through rawXml passthrough of real decks. Round-tripping
			// e2e/fixtures/animation-builds-color.pptx reproduced it from a single
			// attribute. Turning the option off is also symmetric with the parser:
			// `allowBooleanAttributes` is left at its default `false` there, so a
			// valueless attribute is silently DROPPED on read-back.
			suppressBooleanAttributes: false,
			// Pretty-printing is intentionally disabled. PowerPoint ignores
			// inter-element whitespace in OOXML parts, so indentation buys
			// nothing on read-back but costs measurable serialize time (~2.3s of
			// a ~5.3s save on a 112k-element / 100MB deck) and inflates the
			// pre-compression part size. Emitting compact XML is both faster and
			// smaller with no fidelity loss. See packages/core/scripts/perf-large.ts.
			format: false,
			// fast-xml-parser's built-in encoder runs ONE regex list over both text
			// nodes and attribute values, so it cannot express the two rules that
			// actually differ between the two positions:
			//   * an attribute's quote delimiters are escaped separately, AFTER this
			//     processor, so the shared list would double-escape them;
			//   * tab / LF / CR are legal literals in text but are collapsed to a
			//     space by attribute-value normalisation (XML 1.0 3.3.3), so inside
			//     an attribute they MUST be numeric references. Writing a raw `\n`
			//     into `descr="…"` quietly turns every line break in the alt text
			//     into a space on the next load.
			// Take the encoding over instead: `encodeXmlTextValue` reproduces the
			// built-in list exactly (so text output is byte-for-byte unchanged) plus
			// `\r`, and `encodeXmlAttributeValue` applies the attribute rules.
			processEntities: false,
			tagValueProcessor: (_tagName: string, tagValue: unknown) =>
				encodeXmlTextValue(String(tagValue)),
			attributeValueProcessor: (_attrName: string, attrValue: unknown) =>
				encodeXmlAttributeValue(String(attrValue)),
		});
		const build = builder.build.bind(builder);
		builder.build = ((value: unknown) =>
			stripXmlOrderMarkers(build(value))) as typeof builder.build;
		return builder;
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
