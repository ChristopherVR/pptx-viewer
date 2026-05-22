/**
 * Resolve a human-friendly display label for a slide layout.
 *
 * Order of preference:
 *   1. The cSld `@name` attribute, if it is non-empty and not just the
 *      raw ZIP path.
 *   2. The OOXML `@type` attribute mapped to its standard English label
 *      (e.g. `"obj"` → `"Title and Content"`).
 *   3. `"Slide Layout N"` parsed from the ZIP path (`slideLayoutN.xml`),
 *      or plain `"Slide Layout"` if no number can be found.
 */

const TYPE_LABELS: Record<string, string> = {
	title: 'Title Slide',
	tx: 'Title and Text',
	twoColTx: 'Two Column Text',
	tbl: 'Title and Table',
	txOverObj: 'Text Over Object',
	obj: 'Title and Content',
	txAndObj: 'Text and Content',
	objAndTx: 'Content and Text',
	objOverTx: 'Object Over Text',
	twoObj: 'Two Content',
	twoObjAndObj: 'Two Content and Content',
	objAndTwoObj: 'Content and Two Content',
	twoObjAndTx: 'Two Content and Text',
	twoObjOverTx: 'Two Content Over Text',
	fourObj: 'Four Content',
	twoTxTwoObj: 'Comparison',
	blank: 'Blank',
	vertTx: 'Vertical Text',
	clipArtAndTx: 'Clip Art and Text',
	clipArtAndVertTx: 'Clip Art and Vertical Text',
	vertTitleAndTx: 'Vertical Title and Text',
	vertTitleAndTxOverChart: 'Vertical Title and Text Over Chart',
	titleOnly: 'Title Only',
	objTx: 'Content with Caption',
	picTx: 'Picture with Caption',
	secHead: 'Section Header',
	objOnly: 'Object Only',
	mediaAndTx: 'Media and Text',
	dgm: 'Diagram',
	chart: 'Chart',
	cust: 'Custom',
};

export interface LayoutDisplayNameInput {
	name?: string;
	type?: string;
	path: string;
}

function looksLikePath(value: string): boolean {
	return /[\\/]/.test(value) || /\.xml$/i.test(value);
}

function fallbackFromPath(path: string): string {
	const match = /slideLayout(\d+)\.xml$/i.exec(path);
	return match ? `Slide Layout ${match[1]}` : 'Slide Layout';
}

export function resolveLayoutDisplayName(input: LayoutDisplayNameInput): string {
	const trimmed = (input.name ?? '').trim();
	if (trimmed && !looksLikePath(trimmed)) {
		return trimmed;
	}

	const type = (input.type ?? '').trim();
	if (type && TYPE_LABELS[type]) {
		return TYPE_LABELS[type];
	}

	return fallbackFromPath(input.path);
}
