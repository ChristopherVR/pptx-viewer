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

/**
 * The deepest element nesting accepted in any OOXML part, on BOTH the read and
 * the write side.
 *
 * ## Why this is set at all
 *
 * fast-xml-parser and fast-xml-builder each default `maxNestedTags` to 100 and
 * THROW past it, and the two compare it differently (`stack.length > max` in
 * the parser, `depth >= max` in the builder), on top of which the builder
 * measures the parsed OBJECT rather than the source XML. At the shared default
 * that puts the builder's ceiling BELOW the parser's, which opens a window
 * where a part loads and then cannot be written back. Measured against the real
 * pipeline, a slide carrying 89, 90 or 91 nested `p:grpSp` parses cleanly and
 * throws "Maximum nested tags exceeded" on save: the user can open the deck,
 * edit it, and lose the work at the moment they try to keep it. A refusal on
 * LOAD is a bad day; a refusal on SAVE is lost work, so the parser has to be
 * the only ceiling, which is what the doubled builder limit below buys.
 *
 * ## Why 256 rather than 100
 *
 * Scanned across all 45 committed decks (`e2e/fixtures` + the corpus), every
 * XML part in every deck: the deepest element nesting anywhere is **25**, in an
 * animation `p:timing` tree (`issue-132-gradient-fill.pptx`, slide 10), and the
 * deepest nested-group chain is **3**. So 100 is not reachable by anything we
 * have. But 100 is fast-xml-parser's arbitrary default, not a considered OOXML
 * limit: `p:grpSp` nests without bound in the schema, each level costs exactly
 * one unit of depth, and a deck built by a generator that groups repeatedly is
 * the one plausible way to reach it. 256 keeps a real bound (a hostile file
 * cannot drive unbounded work) with ~10x headroom over anything observed and
 * ~8x over `MAX_GROUP_DEPTH`, while staying far below the point where the
 * parser's own recursive JSON conversion overflows the stack (measured between
 * 5,000 and 20,000).
 */
const MAX_XML_NESTING_DEPTH = 256;

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
			// See MAX_XML_NESTING_DEPTH. The parser rejects when the open-tag stack
			// is STRICTLY greater than this, so it tolerates a part one element
			// deeper than the number given; the builder is compensated below so the
			// two ceilings land on the same part.
			maxNestedTags: MAX_XML_NESTING_DEPTH,
			// XML comments stay DROPPED (`commentPropName` left at its `false`
			// default), deliberately. Scanning every part of all 45 committed decks
			// found ZERO comments, in slides, rels and `[Content_Types].xml` alike,
			// so nothing we have is losing anything. Turning it on would not be
			// free or even faithful: fast-xml-parser stores a comment as a
			// `#comment` KEY on its parent, which (a) injects a key the ~50 runtime
			// mixins that enumerate `Object.keys(spTree)` have never seen, and (b)
			// groups by tag like every other key, so `<!--A--><p:sp/><!--B--><p:sp/>`
			// rebuilds as `<!--A--><!--B--><p:sp/><p:sp/>` - the same interleaved-
			// sibling collapse that has already cost this repo four separate order
			// annotators (custGeom, OMML, SmartArt text, a:fld/a:br). An XML comment
			// carries no schema meaning, so the choice is between dropping one and
			// relocating it, and dropping is the honest half. Parts we do not parse
			// keep their comments regardless: they are copied through byte for byte.
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
			// See MAX_XML_NESTING_DEPTH. The doubling makes the PARSER the single
			// gatekeeper: whatever it let into the model, the builder can write back.
			// Matching the two numbers exactly does not achieve that, because the
			// builder measures a different thing. It walks the parsed OBJECT, where
			// repeated siblings sit under an extra array level and our own
			// order-annotation keys (`#pptx-order-N`, custGeom / OMML / SmartArt /
			// paragraph) add levels the source XML never had, so its depth runs 1-2
			// above the parser's for the same part and drifts with what the
			// annotators do. Deriving that offset would mean pinning two libraries'
			// internals plus our annotators; a margin no realistic accounting
			// difference can cross is both simpler and stabler, and the builder
			// still keeps a bound of its own for models built programmatically
			// rather than parsed. The round-trip test asserts the property directly.
			maxNestedTags: MAX_XML_NESTING_DEPTH * 2,
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
