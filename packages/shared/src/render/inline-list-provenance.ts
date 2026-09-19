import { isBulletMarkerSegment } from './bullet-toggle';
import { inlineListDescendants, inlineListSession } from './inline-list-seed';
import type { InlineListSeed, InlineTextEditSnapshot } from './inline-list-types';
import { isParagraphSeparatorSegment } from './text-segment-paragraph-break';

interface HiddenOrigin {
	node: Node | undefined;
	kind: 'empty' | 'marker';
	index: number;
}
interface Provenance {
	seed: InlineListSeed;
	root: HTMLElement;
	paragraphs: Map<Node, number | null>;
	hidden: HiddenOrigin[];
}
const snapshots = new WeakMap<InlineTextEditSnapshot, Provenance>();

/** Private DOM identity, never copied into an exported editor snapshot. */
export function recordInlineListProvenance(
	seed: InlineListSeed,
	root: HTMLElement,
	snapshot: InlineTextEditSnapshot,
	blocks: readonly Node[],
	origins: readonly (Node | undefined)[],
	unchanged: boolean,
): void {
	const session = inlineListSession(seed)!;
	const paragraphs = new Map<Node, number | null>();
	const hidden: HiddenOrigin[] = [];
	const segments = snapshot.textSegments ?? [];
	let paragraphIndex = 0;
	let start = 0;
	const record = (end: number, terminator?: number): void => {
		const block = blocks[paragraphIndex++];
		if (!block) return;
		paragraphs.set(block, start < end ? start : (terminator ?? null));
		const body = segments.slice(start, end);
		const content = body.filter((segment, index) => index !== 0 || !isBulletMarkerSegment(segment));
		const onlyEmptyCarrier =
			content.length === 1 && content[0].text === '' && !content[0].isLineBreak;
		for (let index = start; index < end; index++) {
			const segment = segments[index];
			const marker = index === start && isBulletMarkerSegment(segment);
			if (!marker && (segment.text !== '' || segment.isLineBreak)) continue;
			const node =
				marker || onlyEmptyCarrier
					? block
					: unchanged
						? inlineListDescendants(block).find((child) => session.runNodes.get(child) === index)
						: origins[index];
			hidden.push({ node, kind: marker ? 'marker' : 'empty', index });
		}
	};
	for (const [index, segment] of segments.entries()) {
		if (!isParagraphSeparatorSegment(segment)) continue;
		record(index, index);
		start = index + 1;
	}
	record(segments.length);
	snapshots.set(snapshot, { seed, root, paragraphs, hidden });
}

/** Match only unique, actually retained DOM nodes, never inherited data tokens. */
export function readInlineListProvenance(
	snapshot: InlineTextEditSnapshot,
	previous?: InlineTextEditSnapshot,
): { paragraphSources: (number | null)[]; hiddenSources: (number | null)[] } | undefined {
	const current = snapshots.get(snapshot);
	const before = previous && snapshots.get(previous);
	if (
		!current ||
		(previous && (!before || before.seed !== current.seed || before.root !== current.root))
	) {
		return undefined;
	}
	const matches = (a: HiddenOrigin, b: HiddenOrigin): boolean =>
		a.node !== undefined && a.node === b.node && a.kind === b.kind;
	return {
		paragraphSources: [...current.paragraphs.keys()].map(
			(node) => before?.paragraphs.get(node) ?? null,
		),
		hiddenSources: current.hidden.map((origin) => {
			const old = before?.hidden.filter((candidate) => matches(origin, candidate));
			return old?.length === 1 &&
				current.hidden.filter((candidate) => matches(origin, candidate)).length === 1
				? old[0].index
				: null;
		}),
	};
}
