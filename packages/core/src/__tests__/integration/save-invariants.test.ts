/**
 * Corpus-wide locks on the corruption classes this repo has already shipped.
 *
 * Every invariant below was, at some point, violated by the save pipeline on a
 * real deck, and in most cases the result was a file PowerPoint refused to
 * open. Each was fixed with a unit test beside the writer that produced it.
 * Those unit tests are necessary but not sufficient: a unit test asserts what
 * one writer emits for one hand-built input, whereas the defects were only
 * visible in the assembled PACKAGE, on markup nobody thought to hand-build.
 *
 * So this file asserts the same invariants a second time, from the outside, on
 * the real save output of every deck in the manifest. It is the control that
 * would have caught all eight: none of them needed a new fixture, only somebody
 * looking at the bytes.
 *
 * The invariants, and the damage each one did:
 *
 * | Invariant | Was |
 * | --- | --- |
 * | one `p:transition` per slide | the MCE envelope was kept AND a fresh sibling written, giving three per slide on 26 of 29 fixture slides |
 * | `p:spTree` order preserved | the tree was rebuilt one bucket per tag, silently restacking every mixed-content slide |
 * | no `p:sp` around a graphicFrame body | grouping a chart/table/SmartArt wrapped `CT_GraphicalObjectFrame` content in `CT_Shape` |
 * | attributes keep their value | the builder suppressed boolean attributes, so `val="true"` serialised as `val` |
 * | chart numerics are unsuffixed | `c:lblOffset="100%"` is schema-legal and PowerPoint still rejects it |
 * | `ST_PositiveFixedAngle` is non-negative | shadow directions in the lower half plane emitted a negative angle |
 * | group children survive an edit | children were re-serialised from the group's rawXml with only `a:xfrm` patched |
 *
 * Each check is self-tested against a deliberately corrupted package, because
 * a detector that cannot fail is worse than no detector: it reports green
 * forever. The `detects a ...` cases are those self-tests.
 *
 * @see fixture-corpus-roundtrip.test.ts for the general round-trip harness.
 * @see scripts/com-acceptance.mjs for the PowerPoint ground-truth pass.
 */
import { describe, it, expect, beforeAll } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import {
	countTag,
	roundTrip,
	slideChildTags,
	slidePartPaths,
	spTreeChildOrder,
	spTreeDeepChildOrder,
	templatePartPaths,
	toArrayBuffer,
} from './fixture-corpus-harness';
import { FIXTURE_MANIFEST, fixturePath } from './fixture-corpus-manifest';

const TIMEOUT = 120_000;

const ROUNDTRIPPABLE = FIXTURE_MANIFEST.filter((e) => e.status === 'roundtrip');

/**
 * The `p:cNvPr/@name` of every shape in a part, sorted, as a multiset.
 *
 * Names, not ids: `PptxShapeIdValidator` may legitimately renumber a duplicate
 * `@id` on save, so an id-based comparison would report accepted behaviour as a
 * defect. Names are written back verbatim and are stable.
 */
function shapeNames(xml: string): string[] {
	return [...xml.matchAll(/<p:cNvPr\b[^>]*\bname="([^"]*)"/g)].map((m) => m[1]).sort();
}

/** Every distinct attribute value in a part. */
function attributeValues(xml: string): Set<string> {
	return new Set([...xml.matchAll(/\s[\w.:-]+="([^"]*)"/g)].map((m) => m[1]));
}

/** Multiset difference `a \ b`, preserving repeats. */
function without(a: readonly string[], b: readonly string[]): string[] {
	const remaining = [...b];
	return a.filter((x) => {
		const at = remaining.indexOf(x);
		if (at >= 0) {
			remaining.splice(at, 1);
			return false;
		}
		return true;
	});
}

/** One XML part of one deck, before and after a no-edit save. */
interface PartPair {
	readonly deck: string;
	readonly label: string;
	readonly before: string;
	readonly after: string;
	/** Harness check names this deck is a declared known defect for. */
	readonly knownDefects: readonly string[];
}

/** `ppt/slides/slideN.xml` only. */
const slidePairs: PartPair[] = [];
/** `ppt/slideLayouts/*` and `ppt/slideMasters/*`. */
const templatePairs: PartPair[] = [];
/** Every XML part in the package. */
const allPairs: PartPair[] = [];
/** Per deck, every `p:cNvPr/@name` that appears in a layout or master. */
const templateNamesByDeck = new Map<string, Set<string>>();

/**
 * Save every deck ONCE and index the results three ways.
 *
 * This used to be three separate passes (one here, one inside the
 * valueless-attribute test, one in the numeric block), which tripled the
 * cost of the slowest file in the package for no benefit. Collect once.
 */
beforeAll(async () => {
	for (const entry of ROUNDTRIPPABLE) {
		const rt = await roundTrip(entry);
		const knownDefects = Object.keys(entry.knownDefects ?? {});
		const slides = new Set(slidePartPaths(rt.after));
		const templates = new Set(templatePartPaths(rt.after));
		const templateNames = new Set<string>();

		for (const part of Object.keys(rt.after.files).filter((n) => /\.(xml|rels)$/.test(n))) {
			const pair: PartPair = {
				deck: entry.file,
				label: `${entry.file} ${part}`,
				before: (await rt.before.file(part)?.async('string')) ?? '',
				after: await rt.after.file(part)!.async('string'),
				knownDefects,
			};
			allPairs.push(pair);
			if (slides.has(part)) {
				slidePairs.push(pair);
			}
			if (templates.has(part)) {
				templatePairs.push(pair);
				for (const name of shapeNames(pair.before)) {
					templateNames.add(name);
				}
			}
		}
		templateNamesByDeck.set(entry.file, templateNames);
	}
	// If this ever collapses the whole file becomes vacuous. Thrown rather than
	// expected because a bare `expect` in a hook is not a test assertion.
	if (slidePairs.length < 150) {
		throw new Error(
			`Only ${slidePairs.length} slide parts collected; the corpus invariants would be vacuous.`,
		);
	}
}, 900_000);

/** Collect the failing labels rather than dying on the first, so one run tells the whole story. */
function violations(
	predicate: (pair: PartPair) => string | undefined,
	pairs: readonly PartPair[] = slidePairs,
): string[] {
	return pairs.map(predicate).filter((v): v is string => v !== undefined);
}

/**
 * Run a corpus-wide invariant while honouring the known-defect ledger in
 * `fixture-corpus-manifest.ts`.
 *
 * Decks that declare `check` are held out of the main assertion AND asserted to
 * be STILL BROKEN. That is what stops the ledger rotting: the day somebody
 * fixes the underlying bug this goes red and names the entry to delete, rather
 * than quietly excusing a deck that no longer needs excusing.
 */
function expectInvariant(
	check: string,
	predicate: (pair: PartPair) => string | undefined,
	pairs: readonly PartPair[] = slidePairs,
): void {
	const excused = pairs.filter((p) => p.knownDefects.includes(check));
	const held = pairs.filter((p) => !p.knownDefects.includes(check));

	expect(violations(predicate, held)).toStrictEqual([]);

	if (excused.length > 0 && violations(predicate, excused).length === 0) {
		throw new Error(
			`knownDefects.${check} excuses ${excused.length} slide parts that now pass. ` +
				'If the defect is fixed, delete the entry from fixture-corpus-manifest.ts.',
		);
	}
}

/**
 * Transitions a single reader would apply: every `p:transition` outside an
 * `mc:Fallback`, since the Fallback is the alternative to its sibling Choice
 * rather than an additional declaration.
 */
function appliedTransitionCount(slideXml: string): number {
	const withoutFallbacks = slideXml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, '');
	return countTag(withoutFallbacks, 'p:transition');
}

describe('save invariants: CT_Slide cardinality', () => {
	/**
	 * `CT_Slide` (ECMA-376 §19.3.1.38) is a sequence with `transition` at
	 * `maxOccurs="1"`. A deck whose transition lives in `mc:AlternateContent`
	 * used to keep the envelope verbatim AND get a freshly written direct
	 * sibling, so a `p:sld` came back with two or three.
	 */
	it('emits at most one direct p:transition per slide', () => {
		expectInvariant('singleTransition', ({ label, after }) => {
			const n = slideChildTags(after).filter((t) => t === 'p:transition').length;
			return n > 1 ? `${label}: ${n} direct p:transition children` : undefined;
		});
	});

	/**
	 * An `mc:Fallback` copy is not a duplicate declaration: it is the branch a
	 * reader that does not understand the Choice uses INSTEAD, and PowerPoint
	 * writes one beside every extension transition it emits. So the count that
	 * matters is the number of transitions a single reader would apply - direct
	 * children plus one per envelope - not the raw element count. The wave-1
	 * defect (envelope kept AND a direct sibling written) still trips this,
	 * because that is 2 by this measure where the source had 1.
	 */
	it('never increases the number of transitions a reader would apply', () => {
		expectInvariant('transitionCountStable', ({ label, before, after }) => {
			const b = appliedTransitionCount(before);
			const a = appliedTransitionCount(after);
			return a > b ? `${label}: applied p:transition ${b} -> ${a}` : undefined;
		});
	});

	/**
	 * The gap the "applied" measure leaves, closed.
	 *
	 * Ignoring `mc:Fallback` contents is right for counting what a reader
	 * applies, but it means a duplicate emitted INSIDE a Fallback would be
	 * invisible: PowerPoint understands the Choice and never reads that branch,
	 * yet a reader that does not would see two transitions and the part would
	 * still be schema-invalid. Each branch of an envelope may declare at most
	 * one transition, so assert that directly rather than widening any further.
	 *
	 * The original wave-1 defect is NOT masked by the widening, checked
	 * explicitly: the source had one envelope (applied 1), the bug kept the
	 * envelope AND added a direct sibling (applied 2), so `a > b` still trips.
	 */
	it('emits at most one p:transition per mc:Choice or mc:Fallback branch', () => {
		expectInvariant('transitionPerBranch', ({ label, after }) => {
			for (const branch of after.matchAll(/<mc:(Choice|Fallback)\b[^>]*>([\s\S]*?)<\/mc:\1>/g)) {
				const n = countTag(branch[2], 'p:transition');
				if (n > 1) {
					return `${label}: mc:${branch[1]} declares ${n} p:transition`;
				}
			}
			return undefined;
		});
	});

	it('exercises slides that carry a transition at all', () => {
		const withTransition = slidePairs.filter(({ before }) => countTag(before, 'p:transition') > 0);
		expect(withTransition.length).toBeGreaterThan(5);
		// The defect was specific to a transition inside an mc:AlternateContent
		// envelope, so at least one deck must still have one.
		expect(
			withTransition.filter(({ before }) => /<mc:AlternateContent/.test(before)).length,
		).toBeGreaterThan(0);
	});
});

describe('save invariants: spTree document order is paint order', () => {
	/**
	 * `CT_GroupShape` (§19.3.1.42) is a repeating choice: `p:sp`, `p:pic`,
	 * `p:cxnSp`, `p:graphicFrame` and `p:grpSp` interleave freely and document
	 * order IS z-order. fast-xml-parser collapses that to one array per tag, so
	 * the writer used to emit all shapes, then all pictures, then all
	 * connectors. Pictures that were behind text came back in front of it on a
	 * deck the user only opened and saved.
	 */
	it('preserves the exact child sequence of every p:spTree', () => {
		expectInvariant('spTreeOrderStable', ({ label, before, after }) => {
			const b = spTreeChildOrder(before).join(',');
			const a = spTreeChildOrder(after).join(',');
			return b !== a ? `${label}:\n  before ${b}\n  after  ${a}` : undefined;
		});
	});

	/**
	 * The same rule for `slideLayout` and `slideMaster` parts, which the
	 * original version of this invariant did not cover.
	 *
	 * That omission mattered: measured against a pristine `HEAD` worktree, the
	 * defect was present on 31 template parts across 7 decks and had been all
	 * along, while the slide-part count went 12 to 0 when the layout-group leak
	 * was fixed. Restricting a corpus-wide rule to slides is the same blind spot
	 * that let the slide version ship in the first place, so both are held here
	 * now. Both are green.
	 *
	 * The cause was NOT a template writer rebuilding the tree wrongly, which is
	 * what the symptom looks like and what this comment used to claim. On a
	 * plain save a layout or master never reaches a writer at all: it is flushed
	 * straight through by the passthrough path in
	 * `PptxHandlerRuntimeSavePipeline.ts`, and the parsed object it re-serialises
	 * is ALREADY tag-bucketed, because fast-xml-parser key order is
	 * first-appearance order and `preserveOrder` is off. The authored order had
	 * nowhere to come from. Worth remembering when the next ordering bug shows
	 * up: look for where the order is recorded before blaming the code that
	 * emits it. The same defect was fixed in the notes-master and handout-master
	 * writers at the same time.
	 */
	it('preserves the exact child sequence of every layout and master spTree', () => {
		expectInvariant(
			'templateSpTreeOrderStable',
			({ label, before, after }) => {
				const b = spTreeChildOrder(before).join(',');
				const a = spTreeChildOrder(after).join(',');
				return b !== a ? `${label}:\n  before ${b}\n  after  ${a}` : undefined;
			},
			templatePairs,
		);
	});

	/**
	 * Paint order applies inside a group too, so compare the whole subtree.
	 *
	 * This is the assertion `template-group.pptx` was authored for. Every one of
	 * the 22 template groups already in the corpus is homogeneous, which means a
	 * deep check passed whether the pipeline regrouped children by tag or not:
	 * the agent who fixed template ordering could only prove the recursion
	 * worked by deleting it and watching a hand-written unit test fail. With a
	 * mixed-tag group in a layout, the corpus can finally tell the difference.
	 */
	it('preserves the group-inclusive child sequence of every spTree', () => {
		expectInvariant(
			'templateSpTreeDeepOrderStable',
			({ label, before, after }) => {
				const b = spTreeDeepChildOrder(before).join(',');
				const a = spTreeDeepChildOrder(after).join(',');
				return b !== a ? `${label}:\n  before ${b}\n  after  ${a}` : undefined;
			},
			[...slidePairs, ...templatePairs],
		);
	});

	it('detects a group whose children were regrouped by tag', () => {
		// The exact before/after `template-group.pptx` would produce if the
		// recursion into p:grpSp were removed again.
		const tree = (inner: string): string =>
			`<p:spTree><p:nvGrpSpPr/><p:grpSpPr/><p:grpSp>${inner}</p:grpSp></p:spTree>`;
		const authored = tree('<p:sp/><p:cxnSp/><p:sp/><p:cxnSp/>');
		const bucketed = tree('<p:sp/><p:sp/><p:cxnSp/><p:cxnSp/>');

		expect(spTreeDeepChildOrder(authored)).toStrictEqual([
			'0:p:grpSp',
			'1:p:sp',
			'1:p:cxnSp',
			'1:p:sp',
			'1:p:cxnSp',
		]);
		expect(spTreeDeepChildOrder(bucketed)).not.toStrictEqual(spTreeDeepChildOrder(authored));

		// And the shallow check cannot tell them apart, which is why the deep one
		// had to exist.
		expect(spTreeChildOrder(bucketed)).toStrictEqual(spTreeChildOrder(authored));
	});

	it('exercises at least one template group with mixed child tags', () => {
		// Without this the deep check above is vacuous on template parts, which
		// is precisely the state the corpus was in before template-group.pptx.
		const mixedGroups = templatePairs.filter(({ before }) =>
			[...before.matchAll(/<p:grpSp>([\s\S]*?)<\/p:grpSp>/g)].some(
				(m) =>
					new Set([...m[1].matchAll(/<(p:sp|p:pic|p:cxnSp|p:graphicFrame)[\s>]/g)].map((x) => x[1]))
						.size > 1,
			),
		);
		expect(mixedGroups.length).toBeGreaterThan(0);
	});

	it('exercises layouts and masters that actually interleave element kinds', () => {
		const mixed = templatePairs.filter(({ before }) => {
			const kinds = new Set(
				spTreeChildOrder(before).filter((t) => t !== 'p:nvGrpSpPr' && t !== 'p:grpSpPr'),
			);
			return kinds.size > 1;
		});
		expect(mixed.length).toBeGreaterThan(10);
	});

	it('exercises slides that actually interleave element kinds', () => {
		// Guard against the invariant above passing only because every slide is
		// homogeneous. It was invisible to the existing corpus for that reason.
		const mixed = slidePairs.filter(({ before }) => {
			const kinds = new Set(
				spTreeChildOrder(before).filter((t) => t !== 'p:nvGrpSpPr' && t !== 'p:grpSpPr'),
			);
			return kinds.size > 1;
		});
		expect(mixed.length).toBeGreaterThan(20);
	});
});

describe('save invariants: element bodies match their wrapper', () => {
	/**
	 * A `p:graphicFrame` body (chart, table, SmartArt, OLE) inside `p:sp` is
	 * `CT_Shape` holding `CT_GraphicalObjectFrame` content. PowerPoint rejects
	 * it outright.
	 */
	it('never wraps a graphicFrame body in p:sp', () => {
		expectInvariant('graphicFrameWrapper', ({ label, after }) =>
			/<p:sp>(?:(?!<\/p:sp>)[\s\S]){0,600}?<p:nvGraphicFramePr/.test(after)
				? `${label}: p:sp wrapping a graphicFrame body`
				: undefined,
		);
	});

	it('exercises slides that actually carry a graphicFrame', () => {
		expect(
			slidePairs.filter(({ before }) => countTag(before, 'p:graphicFrame') > 0).length,
		).toBeGreaterThan(5);
	});
});

describe('save invariants: layout content stays in the layout', () => {
	/**
	 * A slide INHERITS its layout's and master's shapes; it does not own copies
	 * of them. Saving must not turn inheritance into duplication.
	 *
	 * `absolute-path-rels.pptx` used to demonstrate the failure in both
	 * directions at once. Every slide gained the layout's two `p:grpSp` at the
	 * FRONT of its spTree, and the layout itself was flattened, promoting the
	 * four ovals out of those groups to top level and leaving duplicated
	 * `p:cNvPr/@id` in one tree, which `CT_NonVisualDrawingProps` forbids. The
	 * decoration was then painted twice on every slide. PowerPoint measured it
	 * exactly: 82 shapes going in, 106 coming out, on a deck that was only
	 * opened and saved.
	 *
	 * It survived for so long because that deck is the ONLY one in the corpus
	 * whose layouts contain a group, and nothing compared shape identity across
	 * a save. The general rule below costs nothing and holds for every deck.
	 */
	function nameDrift({ label, before, after }: PartPair): string | undefined {
		const b = shapeNames(before);
		const a = shapeNames(after);
		if (b.join('|') === a.join('|')) {
			return undefined;
		}
		const gained = without(a, b);
		const lost = without(b, a);
		return `${label}: gained [${gained.join(', ')}] lost [${lost.join(', ')}] (${b.length} -> ${a.length} shapes)`;
	}

	it('does not add or drop a shape on any slide', () => {
		expectInvariant('slideShapeIdentityStable', nameDrift, slidePairs);
	});

	it('does not add or drop a shape on any layout or master', () => {
		expectInvariant('templateShapeIdentityStable', nameDrift, templatePairs);
	});

	/**
	 * The diagnostic half. A shape a slide gained is far more serious when the
	 * name also exists on that deck's layouts, because that identifies it as
	 * migrated inherited content rather than, say, a duplicated slide shape.
	 */
	it('never copies a name that belongs to a layout into a slide', () => {
		const migrated: string[] = [];
		for (const { deck, label, before, after } of slidePairs) {
			const fromTemplate = templateNamesByDeck.get(deck) ?? new Set<string>();
			for (const name of new Set(without(shapeNames(after), shapeNames(before)))) {
				if (fromTemplate.has(name)) {
					migrated.push(`${label}: "${name}" migrated from a layout or master`);
				}
			}
		}
		expect(migrated).toStrictEqual([]);
	});

	/**
	 * Replays the exact `absolute-path-rels.pptx` corruption on synthetic
	 * markup, so the detector is proven able to fail. Without this the two
	 * assertions above would report green forever if `shapeNames` ever stopped
	 * matching anything.
	 */
	it('detects the layout leak it was written for', () => {
		const sourceSlide = '<p:cNvPr id="1" name=""/><p:cNvPr id="2" name="Title 1"/>';
		const leakedSlide = `<p:cNvPr id="1" name=""/><p:cNvPr id="9" name="Group 8"/>${sourceSlide}`;
		expect(
			nameDrift({
				deck: 'x',
				label: 'x',
				before: sourceSlide,
				after: leakedSlide,
				knownDefects: [],
			}),
		).toContain('Group 8');

		// A flattened layout loses nothing but repeats a name, which a set-based
		// comparison would miss and the multiset catches.
		expect(
			nameDrift({
				deck: 'x',
				label: 'x',
				before: '<p:cNvPr id="4" name="Oval 3"/>',
				after: '<p:cNvPr id="4" name="Oval 3"/><p:cNvPr id="4" name="Oval 3"/>',
				knownDefects: [],
			}),
		).toContain('Oval 3');

		// An id renumbered by the dedup pass is accepted behaviour, not drift.
		expect(
			nameDrift({
				deck: 'x',
				label: 'x',
				before: '<p:cNvPr id="2" name="Group 1"/>',
				after: '<p:cNvPr id="10" name="Group 1"/>',
				knownDefects: [],
			}),
		).toBeUndefined();
	});

	it('exercises decks whose layouts actually carry their own shapes', () => {
		// Without a layout that owns shapes the invariant above is vacuous, and
		// that is precisely the corpus gap that let the defect ship.
		const decksWithTemplateShapes = new Set(
			[...templateNamesByDeck].filter(([, names]) => names.size > 2).map(([deck]) => deck),
		);
		expect(decksWithTemplateShapes.size).toBeGreaterThan(5);
	});
});

/** Start tags carrying an attribute with no `="value"`, which is never legal in XML. */
const VALUELESS_ATTRIBUTE =
	/<[A-Za-z_][\w.:-]*((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)((?:\s+[\w.:-]+(?!\s*=))+)\s*\/?>/;

describe('save invariants: attributes keep their values', () => {
	/**
	 * The XML builder was configured without `suppressBooleanAttributes: false`,
	 * so any attribute whose value was literally `true` lost it:
	 * `<p:strVal val="true"/>` serialised as `<p:strVal val>`. That is not
	 * well-formed XML and PowerPoint refused the file. It stayed invisible
	 * because re-parsing our own output dropped the attribute silently instead
	 * of erroring, so every model-level round-trip test still passed.
	 */
	it('writes no valueless attribute anywhere in the package', () => {
		const bad = allPairs
			.filter(({ after }) => VALUELESS_ATTRIBUTE.test(after))
			.map(({ label, after }) => `${label}: ${VALUELESS_ATTRIBUTE.exec(after)![0].slice(0, 120)}`);
		expect(bad).toStrictEqual([]);
	});

	it('detects a valueless attribute when one is present', () => {
		expect(VALUELESS_ATTRIBUTE.test('<p:strVal val/>')).toBeTruthy();
		expect(VALUELESS_ATTRIBUTE.test('<p:strVal val="true"/>')).toBeFalsy();
		expect(VALUELESS_ATTRIBUTE.test('<a:off x="0" y="0"/>')).toBeFalsy();
	});

	/**
	 * An attribute value that comes back differing from the source ONLY in case
	 * has been passed through a normaliser that had no business rewriting it.
	 *
	 * Most OOXML attribute values are enumeration tokens, and the enumerations
	 * are case-SENSITIVE, so case-folding one produces a token outside its
	 * enumeration and PowerPoint rejects the whole package. This is a nastier
	 * class than it sounds because the great majority of tokens are already
	 * lower-case, which makes a stray `.toLowerCase()` a no-op almost
	 * everywhere and fatal in the few camel-cased places.
	 *
	 * That is exactly how the `folHlink` P0 hid: eleven of the twelve
	 * `ST_ColorSchemeIndex` tokens are lower-case, so lowercasing the parsed
	 * colour-map value looked harmless right up until it hit the one that is
	 * not, at which point PowerPoint refused the file with 0x80070570 and gave
	 * no hint why. `descender-clip.pptx` and `shape-3d-compound.pptx` were both
	 * destroyed by it.
	 *
	 * Written as a DIFFERENTIAL rather than a list of known camel-cased tokens
	 * so it needs no maintenance and covers every enumeration at once: for each
	 * value in the source that is gone from the output, if its lower-cased form
	 * has appeared and was not there before, that value was case-folded. There
	 * is no token list to fall behind the spec.
	 */
	it('never case-folds an attribute value', () => {
		const folded: string[] = [];
		for (const { label, before, after } of allPairs) {
			const source = attributeValues(before);
			const saved = attributeValues(after);
			for (const value of source) {
				const lower = value.toLowerCase();
				if (value === lower || saved.has(value)) {
					continue;
				}
				if (saved.has(lower) && !source.has(lower)) {
					folded.push(`${label}: "${value}" -> "${lower}"`);
				}
			}
		}
		expect([...new Set(folded)]).toStrictEqual([]);
	});

	/**
	 * Replays the `folHlink` P0 on synthetic markup, and pins the two shapes
	 * that must NOT be reported: a value that legitimately changed to something
	 * unrelated, and a lower-case form that was already present in the source.
	 */
	it('detects the case-folding it was written for, and nothing else', () => {
		const fold = (before: string, after: string): string[] => {
			const source = attributeValues(before);
			const saved = attributeValues(after);
			return [...source].filter(
				(v) =>
					v !== v.toLowerCase() &&
					!saved.has(v) &&
					saved.has(v.toLowerCase()) &&
					!source.has(v.toLowerCase()),
			);
		};

		expect(
			fold(
				'<a:overrideClrMapping folHlink="folHlink"/>',
				'<a:overrideClrMapping folHlink="folhlink"/>',
			),
		).toStrictEqual(['folHlink']);

		// Unchanged: nothing to report.
		expect(
			fold(
				'<a:overrideClrMapping folHlink="folHlink"/>',
				'<a:overrideClrMapping folHlink="folHlink"/>',
			),
		).toStrictEqual([]);

		// A genuine value change is not a case fold.
		expect(fold('<a:prstDash val="lgDash"/>', '<a:prstDash val="solid"/>')).toStrictEqual([]);

		// The lower-case form already existed in the source, so its presence in
		// the output proves nothing.
		expect(fold('<x a="sysDash" b="sysdash"/>', '<x a="solid" b="sysdash"/>')).toStrictEqual([]);
	});
});

/**
 * Chart numerics PowerPoint rejects with a percent sign. `ST_LblOffset` and
 * friends are unions that admit `"100%"`, and the schema even documents it as
 * the default, but PowerPoint refuses the file. This was confirmed through
 * PowerPoint COM, not by reading the schema, which said the opposite.
 */
const PERCENT_SUFFIXED_CHART_ATTR =
	/<(c:lblOffset|c:bubbleScale|c:gapWidth|c:overlap|c:holeSize|c:secondPieSize|c:splitPos|c:gapDepth)\b[^>]*val="[^"]*%"/;

/** `ST_PositiveFixedAngle` is 0 through 21599999; a negative value is invalid. */
const NEGATIVE_POSITIVE_FIXED_ANGLE =
	/<(a:outerShdw|a:innerShdw|a:reflection|a:presetShdw)\b[^>]*\bdir="-\d/;

describe('save invariants: numeric lexical forms PowerPoint accepts', () => {
	it('writes no percent-suffixed chart attribute', () => {
		const bad = allPairs
			.filter(({ after: xml }) => PERCENT_SUFFIXED_CHART_ATTR.test(xml))
			.map(({ label, after: xml }) => `${label}: ${PERCENT_SUFFIXED_CHART_ATTR.exec(xml)![0]}`);
		expect(bad).toStrictEqual([]);
	});

	it('writes no negative ST_PositiveFixedAngle', () => {
		const bad = allPairs
			.filter(({ after: xml }) => NEGATIVE_POSITIVE_FIXED_ANGLE.test(xml))
			.map(({ label, after: xml }) => `${label}: ${NEGATIVE_POSITIVE_FIXED_ANGLE.exec(xml)![0]}`);
		expect(bad).toStrictEqual([]);
	});

	it('detects both lexical faults when they are present', () => {
		expect(PERCENT_SUFFIXED_CHART_ATTR.test('<c:lblOffset val="100%"/>')).toBeTruthy();
		expect(PERCENT_SUFFIXED_CHART_ATTR.test('<c:lblOffset val="100"/>')).toBeFalsy();
		expect(
			NEGATIVE_POSITIVE_FIXED_ANGLE.test('<a:outerShdw blurRad="50800" dir="-2700000"/>'),
		).toBeTruthy();
		expect(
			NEGATIVE_POSITIVE_FIXED_ANGLE.test('<a:outerShdw blurRad="50800" dir="2700000"/>'),
		).toBeFalsy();
	});
});

describe('save invariants: an edit to a group child reaches the file', () => {
	/**
	 * Group children used to be re-serialised from the GROUP's own `rawXml`
	 * with only `a:xfrm` patched back, so every other edit to a child - text,
	 * fill, stroke, geometry, effects, locks, crop - was discarded while the
	 * on-screen model stayed correct. The user saw the edit, saved, reopened,
	 * and it was gone.
	 *
	 * `linked-textbox.pptx` slide 1 has a `p:grpSp` whose first child is a text
	 * shape reading "Bravo one two three ...".
	 */
	it(
		'persists a text edit made to a shape nested in a group',
		async () => {
			const entry = FIXTURE_MANIFEST.find((e) => e.file === 'linked-textbox.pptx')!;
			const bytes = toArrayBuffer(
				new Uint8Array((await import('node:fs')).readFileSync(fixturePath(entry))),
			);
			const handler = new PptxHandler();
			const slides = (await handler.load(bytes)).slides;

			const group = slides[0].elements.find((el) => el.type === 'group');
			expect(group, 'fixture no longer has a group on slide 1').toBeDefined();
			if (group?.type !== 'group') {
				throw new Error('unreachable');
			}
			const child = group.children?.find((c) => (c.text ?? '').length > 0);
			expect(child, 'fixture group no longer has a text-bearing child').toBeDefined();

			const edited = 'GROUP-CHILD-EDIT-MARKER';
			child!.text = edited;

			const saved = await handler.save(slides);
			const reloaded = (await new PptxHandler().load(toArrayBuffer(saved))).slides;
			const reloadedGroup = reloaded[0].elements.find((el) => el.type === 'group');
			if (reloadedGroup?.type !== 'group') {
				throw new Error('group vanished on reload');
			}
			const texts = (reloadedGroup.children ?? []).map((c) => c.text ?? '');
			expect(texts).toContain(edited);
		},
		TIMEOUT,
	);
});
