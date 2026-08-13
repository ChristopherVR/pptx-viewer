/**
 * Regression guard: a `<p:grpSp>` nested inside another `<p:grpSp>` must stay
 * nested, in the model and in the saved package.
 *
 * The loader used to recurse into a sub-group and then splice its descendants
 * into the PARENT group's `children` (`elements.push(...subElements)`). Content
 * survived - a slide's `p:sp` count was unchanged - but the wrapper itself was
 * annihilated: its `p:cNvPr/@name`, its `p:grpSpPr` fill / locks, its animation
 * identity and the user's grouping all vanished, and one open-and-save
 * permanently degraded a two-level group into one. The save side has supported
 * nested `p:grpSp` for a while, but nothing loaded from a file could ever
 * exercise it.
 *
 * Both fixtures are genuine PowerPoint-authored decks:
 * - `solution-explorer.pptx` slide 5: `!!Circle` wraps `Group 3` (depth 2).
 * - `issue-132-hr-deck.pptx` slide 18: `组合 13` > `组合 11` > `组合 4`
 *   (depth 3), and slide 20: `组合 36` > `组合 40` > `Group 30`.
 *
 * The names matter as much as the shape: a nested wrapper's name was the
 * visible symptom, and asserting only on "some group exists" would pass with a
 * fabricated wrapper.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { GroupPptxElement, PptxElement, PptxSlide } from '../../core/types';

const fixtureUrl = (name: string) =>
	fileURLToPath(new URL(`../../../../../e2e/fixtures/${name}`, import.meta.url));

/** Depth-first list of every group name, deepest nesting recorded per entry. */
function groupNamesByDepth(
	elements: readonly PptxElement[],
	depth = 0,
	out: Array<{ name: string | undefined; depth: number }> = [],
): Array<{ name: string | undefined; depth: number }> {
	for (const el of elements) {
		if (el.type === 'group') {
			out.push({ name: el.name, depth });
			groupNamesByDepth(el.children, depth + 1, out);
		}
	}
	return out;
}

/**
 * Census of the LEAF (non-group) elements of a slide, keyed by ABSOLUTE
 * position so a leaf that silently moved between two group levels is caught,
 * and in document order so a reordered subtree is caught too.
 *
 * The `type` discriminant is deliberately excluded. Two unrelated, PRE-EXISTING
 * save-writer defects reclassify a leaf across a round trip on this corpus:
 * a `p:sp` carrying an `a:blipFill` loads as `picture` but is re-emitted as a
 * plain `p:sp` (hr-deck slides 18/20), and a text-bearing shape can come back
 * as `shape` (hr-deck slide 11). Both reproduce identically with the group
 * flattening still in place, so folding them into this assertion would only
 * make a nesting regression harder to see. Position and size still pin every
 * leaf exactly.
 */
function leafCensus(
	elements: readonly PptxElement[],
	ox = 0,
	oy = 0,
	out: string[] = [],
): string[] {
	for (const el of elements) {
		if (el.type === 'group') {
			leafCensus(el.children, ox + el.x, oy + el.y, out);
			continue;
		}
		out.push(
			`@${(ox + el.x).toFixed(2)},${(oy + el.y).toFixed(2)}:${el.width.toFixed(2)}x${el.height.toFixed(2)}`,
		);
	}
	return out;
}

/** Maximum `<p:grpSp>` nesting depth in a slide part. */
function xmlGroupDepth(xml: string): number {
	let depth = 0;
	let maxDepth = 0;
	const re = /<(\/?)p:grpSp(\s|>|\/>)/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(xml))) {
		if (match[1] === '/') {
			depth -= 1;
		} else {
			depth += 1;
			maxDepth = Math.max(maxDepth, depth);
		}
	}
	return maxDepth;
}

interface RoundTrip {
	loaded: PptxSlide[];
	reloaded: PptxSlide[];
	savedZip: JSZip;
}

async function roundTrip(name: string): Promise<RoundTrip> {
	const path = fixtureUrl(name);
	// Committed fixture. Fail loudly rather than skipping green: a silent skip
	// is exactly how this class of loss stayed invisible.
	if (!existsSync(path)) {
		throw new Error(`missing committed fixture ${path}`);
	}
	const bytes = readFileSync(path);
	const handler = new PptxHandler();
	const loaded = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	const saved = await handler.save(loaded.slides);
	// Saved packages are DEFLATE-compressed; the part has to be inflated before
	// anything can be asserted about its XML.
	const savedZip = await JSZip.loadAsync(saved);
	const reloaded = await new PptxHandler().load(
		saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
	);
	return { loaded: loaded.slides, reloaded: reloaded.slides, savedZip };
}

async function slideXml(zip: JSZip, oneBasedIndex: number): Promise<string> {
	const file = zip.file(`ppt/slides/slide${oneBasedIndex}.xml`);
	expect(file, `saved package has no slide${oneBasedIndex}.xml`).toBeTruthy();
	return file!.async('string');
}

interface Expectation {
	/** 1-based slide number. */
	readonly slide: number;
	/** Group names in depth-first order, with the nesting level of each. */
	readonly groups: ReadonlyArray<{ name: string; depth: number }>;
	/** Deepest `<p:grpSp>` nesting the saved part must carry. */
	readonly savedDepth: number;
	/**
	 * PowerPoint's own painting order for one group's DIRECT children,
	 * measured over COM (`Shape.Ungroup()` on a copy, since `GroupItems`
	 * flattens nested groups and cannot show the wrapper).
	 */
	readonly childOrder?: { readonly group: string; readonly names: readonly string[] };
}

const CASES: ReadonlyArray<{ fixture: string; expectations: readonly Expectation[] }> = [
	{
		fixture: 'solution-explorer.pptx',
		expectations: [
			{
				slide: 5,
				groups: [
					{ name: '!!Circle', depth: 0 },
					{ name: 'Group 3', depth: 1 },
				],
				savedDepth: 2,
				// PowerPoint COM on the ORIGINAL fixture reports exactly this
				// sequence. The tag-grouped fallback returned `!!Content,
				// Rectangle 4, Group 3`, painting the whole nested subtree in
				// front of a shape it belongs behind.
				childOrder: { group: '!!Circle', names: ['!!Content', 'Group 3', 'Rectangle 4'] },
			},
			{
				slide: 12,
				groups: [
					{ name: 'Group 1', depth: 0 },
					{ name: 'Group 7', depth: 1 },
					{ name: 'Group 11', depth: 0 },
					{ name: 'Group 13', depth: 1 },
				],
				savedDepth: 2,
			},
		],
	},
	{
		fixture: 'issue-132-hr-deck.pptx',
		expectations: [
			{
				slide: 18,
				groups: [
					{ name: '组合 2', depth: 0 },
					{ name: '组合 13', depth: 0 },
					{ name: '组合 11', depth: 1 },
					{ name: '组合 4', depth: 2 },
				],
				savedDepth: 3,
			},
			{
				slide: 20,
				groups: [
					{ name: '组合 36', depth: 0 },
					{ name: '组合 40', depth: 1 },
					{ name: 'Group 30', depth: 2 },
				],
				savedDepth: 3,
			},
		],
	},
];

describe.each(CASES)('nested p:grpSp round trip: $fixture', ({ fixture, expectations }) => {
	// One load/save/reload per fixture, shared by the assertions below: these
	// are multi-megabyte real decks and each pass walks them three times.
	let trip: RoundTrip;

	it('loads, saves and reloads', async () => {
		trip = await roundTrip(fixture);
		expect(trip.loaded.length).toBeGreaterThan(0);
		expect(trip.reloaded).toHaveLength(trip.loaded.length);
	}, 180_000);

	it.each(expectations)(
		'keeps the nested wrapper and its name on slide $slide',
		({ slide, groups }) => {
			const expected = groups.map((g) => ({ name: g.name, depth: g.depth }));

			// 1. The nested wrapper reaches the model, at the right depth, named.
			expect(groupNamesByDepth(trip.loaded[slide - 1].elements)).toStrictEqual(expected);

			// 2. It survives into the saved package as a real nested `p:grpSp`.
			//    Asserted on the reloaded model rather than only on the XML so a
			//    wrapper emitted in the wrong place still fails.
			expect(groupNamesByDepth(trip.reloaded[slide - 1].elements)).toStrictEqual(expected);
		},
	);

	it.each(expectations)(
		'writes a nested <p:grpSp> into saved slide $slide',
		async ({ slide, savedDepth }) => {
			const xml = await slideXml(trip.savedZip, slide);
			expect(xmlGroupDepth(xml)).toBe(savedDepth);
			for (const { name } of expectations.find((e) => e.slide === slide)!.groups) {
				expect(xml).toContain(`name="${name}"`);
			}
		},
	);

	it('gains and loses no content on any slide', () => {
		for (let i = 0; i < trip.loaded.length; i++) {
			expect(
				leafCensus(trip.reloaded[i].elements),
				`slide ${i + 1} leaf census changed across the round trip`,
			).toStrictEqual(leafCensus(trip.loaded[i].elements));
		}
	});

	it.each(expectations.filter((e) => e.childOrder))(
		'stacks the children of slide $slide in document order',
		({ slide, childOrder }) => {
			const wrapper = trip.loaded[slide - 1].elements.find(
				(el) => el.type === 'group' && el.name === childOrder!.group,
			);
			expect(wrapper?.type).toBe('group');
			const names = (wrapper as GroupPptxElement).children.map((c) => c.name);
			expect(names).toStrictEqual(childOrder!.names);
		},
	);
});
