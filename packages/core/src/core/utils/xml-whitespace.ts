/**
 * Which OOXML elements carry text whose leading / trailing whitespace is
 * CONTENT, and must therefore survive the parse verbatim.
 *
 * ## Why this exists
 *
 * The OOXML parser runs with fast-xml-parser `trimValues: false` and re-applies
 * the trim itself in `tagValueProcessor` (see
 * `PptxRuntimeDependencyFactory.createParser`). Trimming cannot simply be turned
 * off wholesale: with it off, the indentation of a pretty-printed part becomes a
 * `#text` node on every container, so `<Properties>\n  <Slides>10</Slides>\n</Properties>`
 * parses with a bogus `"#text": "\n  \n"` sibling. Trimming to `""` is what makes
 * fast-xml-parser drop that node again.
 *
 * So the rule has to be per element, and the correct split is the schema's: an
 * element whose content type is a string (`ST_Xstring` / `xsd:string`) carries
 * whitespace as data, while an element whose content is a number, a token, an
 * enum or a child sequence does not.
 *
 * ## What was losing whitespace
 *
 * Only `a:t` was exempt (GitHub issue #52: PowerPoint splits a sentence across
 * runs and a word boundary often becomes a run whose whole text is one space, so
 * trimming glued the words together). Every other string element was still
 * trimmed, which is why `<c:separator>, </c:separator>` loaded as `","` and a
 * combined data label rendered `Direct,40%` instead of `Direct, 40%`.
 *
 * That class of defect is self-concealing: we trimmed on read and wrote the
 * trimmed value back, so comparing our model against our own re-parse always
 * agreed. Only a comparison against the ORIGINAL bytes shows the loss. `core.xml`
 * and `app.xml` are re-parsed and rebuilt on EVERY save (revision bump, modified
 * timestamp, slide counts), so a title or company name ending in a space lost it
 * silently on any save at all.
 *
 * ## Why not `xml:space="preserve"`
 *
 * It is not a usable signal. It appears zero times across the 49 decks in this
 * repository, including the ones PowerPoint itself wrote, because XML preserves
 * text-node whitespace by DEFAULT; `xml:space="preserve"` only overrides an
 * `xml:space="default"` that is in scope. Our own writer emits it on `a:t` as a
 * courtesy to consumers that normalise, not because the parse depends on it.
 *
 * ## Why qualified names, not local names
 *
 * Matching the local name would be wrong in both directions. `title` would match
 * `c:title`, which is a chart-title CONTAINER whose indentation would become
 * content, and `t` would match `dgm:t`, a SmartArt text BODY that holds `a:p`
 * children. Every entry below is a leaf element, which is what makes preserving
 * its text safe.
 *
 * @module utils/xml-whitespace
 */

/**
 * Leaf elements whose text content is schema-typed as a string, keyed by the
 * qualified name as written in the part.
 */
export const WHITESPACE_PRESERVING_TAGS: ReadonlySet<string> = new Set([
	// DrawingML / PresentationML text.
	'a:t', // run text (issue #52: a lone-space run between two words)
	'p:text', // legacy comment body

	// ChartML strings. `c:v` is a cache value: in a string cache it is the
	// user's category / series label, and in a numeric cache the surrounding
	// whitespace is inert because every consumer coerces with Number().
	'c:separator',
	'c:v',

	// docProps/core.xml (CT_CoreProperties): free text the author typed.
	'dc:title',
	'dc:subject',
	'dc:creator',
	'dc:description',
	'cp:keywords',
	'cp:category',
	'cp:lastModifiedBy',
	'cp:contentStatus',

	// docProps/app.xml + docProps/custom.xml variant strings.
	'vt:lpstr',
	'vt:lpwstr',
	'vt:bstr',
	'Company',
	'Manager',
]);

/**
 * True when `tagName`'s text content must be kept verbatim rather than trimmed.
 *
 * Anything not listed keeps the historical trimmed behaviour, so numeric and
 * enum values stay clean and pretty-printed indentation never becomes content.
 */
export function preservesXmlWhitespace(tagName: string): boolean {
	return WHITESPACE_PRESERVING_TAGS.has(tagName);
}

/**
 * The SpreadsheetML equivalent, for the embedded chart workbook parsed by
 * `chart-xlsx-parser`. `<t>` is the shared-string / inline-string text element,
 * and it is the ONE element in a real OOXML package that actually carries
 * `xml:space="preserve"`: Excel stamps it whenever a cell's string has boundary
 * whitespace. Kept separate from {@link WHITESPACE_PRESERVING_TAGS} because the
 * bare name `t` is only unambiguous inside a workbook part.
 */
const SPREADSHEET_WHITESPACE_PRESERVING_TAGS: ReadonlySet<string> = new Set(['t', 'x:t']);

/** True when `tagName` is SpreadsheetML text whose whitespace is content. */
export function preservesSpreadsheetXmlWhitespace(tagName: string): boolean {
	return SPREADSHEET_WHITESPACE_PRESERVING_TAGS.has(tagName);
}
