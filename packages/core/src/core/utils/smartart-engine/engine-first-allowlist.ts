/**
 * Layouts where the per-point DiagramML engine (`smartart-engine/`) is
 * measurably at least as good as the legacy family-based interpreter
 * (`smartart-layout-interpreter.ts`) on EVERY dataset fixture of that
 * layout in the 229-fixture COM gallery corpus, with no shape-set loss
 * (`packages/core/src/__tests__/fixtures/smartart-gallery/`): the engine
 * matches at least as many cached-drawing shapes as legacy on every
 * dataset, and its worst geometry deviation is never larger than legacy's.
 * Most entries are strictly smaller on at least one dataset; a few (Basic
 * Pyramid, Inverted Pyramid) tie legacy exactly on every dataset instead -
 * still listed since routing to either engine costs nothing when they agree,
 * and it keeps the pyramid family on one code path.
 *
 * `computeDiagramMlElements` (`smartart-decompose-diagram.ts`) consults
 * this set to try the engine BEFORE the legacy interpreter for a listed
 * `layoutDefinition.uniqueId`, falling back to legacy (then the
 * algorithmic heuristic) exactly as before when the engine declines.
 *
 * Measured 2026-09-24 with `scripts/measure-smartart-engine-vs-legacy.ts`;
 * see that script's own doc comment for the exact inclusion rule and
 * `docs/architecture/openxml-conformance.md#smartart-layout-ground-truth`
 * for the resulting gate numbers. Regenerate this list (in comparison
 * mode) whenever either engine changes, rather than hand-editing it: a
 * hand edit with no fresh measurement is exactly the kind of unverified
 * claim this file exists to avoid.
 */

export const ENGINE_FIRST_LAYOUT_IDS: ReadonlySet<string> = new Set([
	'urn:microsoft.com/office/officeart/2005/8/layout/hProcess4', // Alternating Flow (legacy<=0.2083 -> engine<=0.0188)
	'urn:microsoft.com/office/officeart/2008/layout/AlternatingPictureBlocks', // Alternating Picture Blocks (legacy<=0.233 -> engine<=0.0288)
	'urn:microsoft.com/office/officeart/2008/layout/AlternatingPictureCircles', // Alternating Picture Circles (legacy<=0.4394 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2008/layout/AscendingPictureAccentProcess', // Ascending Picture Accent Process (legacy<=0.3576 -> engine<=0)
	'urn:microsoft.com/office/officeart/2005/8/layout/matrix3', // Basic Matrix (legacy<=0.7601 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/chart3', // Basic Pie (legacy<=0.0375 -> engine<=0)
	'urn:microsoft.com/office/officeart/2005/8/layout/pyramid1', // Basic Pyramid (legacy<=0.0019 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/hProcess11', // Basic Timeline (legacy<=0.3583 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/venn1', // Basic Venn (legacy<=0.0938 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2008/layout/BendingPictureBlocks', // Bending Picture Blocks (legacy<=0.4821 -> engine<=0.4671)
	'urn:microsoft.com/office/officeart/2008/layout/BendingPictureCaption', // Bending Picture Caption (legacy<=0.4014 -> engine<=0.4002)
	'urn:microsoft.com/office/officeart/2008/layout/BubblePictureList', // Bubble Picture List (legacy<=0.0863 -> engine<=0)
	'urn:microsoft.com/office/officeart/2008/layout/CaptionedPictures', // Captioned Pictures (legacy<=0.6642 -> engine<=0.6263)
	'urn:microsoft.com/office/officeart/2005/8/layout/chevronAccent+Icon', // Chevron Accent Process (legacy<=0.8161 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2009/layout/CircleArrowProcess', // Circle Arrow Process (legacy<=0.1684 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2011/layout/CircleProcess', // Circle Process (legacy<=0.6632 -> engine<=0.0113)
	'urn:microsoft.com/office/officeart/2009/3/layout/CircleRelationship', // Circle Relationship (legacy<=0.0356 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/hProcess9', // Continuous Block Process (legacy<=0.6004 -> engine<=0.0346)
	'urn:microsoft.com/office/officeart/2005/8/layout/hList7', // Continuous Picture List (legacy<=0.469 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/arrow5', // Converging Arrows (legacy<=0.0638 -> engine<=0.0375)
	'urn:microsoft.com/office/officeart/2005/8/layout/arrow3', // Counterbalance Arrows (legacy<=0.2889 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/cycle4', // Cycle Matrix (legacy<=0.227 -> engine<=0.0113)
	'urn:microsoft.com/office/officeart/2009/3/layout/BlockDescendingList', // Descending Block List (legacy<=0.1696 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2009/3/layout/DescendingProcess', // Descending Process (legacy<=0.7497 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/arrow1', // Diverging Arrows (legacy<=0.0638 -> engine<=0.0375)
	'urn:microsoft.com/office/officeart/2005/8/layout/equation1', // Equation (legacy<=0.0281 -> engine<=0.0131)
	'urn:microsoft.com/office/officeart/2009/3/layout/FramedTextPicture', // Framed Text Picture (legacy<=0.3276 -> engine<=0.2987)
	'urn:microsoft.com/office/officeart/2005/8/layout/funnel1', // Funnel (legacy<=0.3068 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/gear1', // Gear (legacy<=0.7589 -> engine<=0.0882)
	'urn:microsoft.com/office/officeart/2005/8/layout/matrix2', // Grid Matrix (legacy<=0.2514 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/lProcess2', // Grouped List (legacy<=0.5779 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2008/layout/HexagonCluster', // Hexagon Cluster (legacy<=0.0115 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/pList2', // Horizontal Picture List (legacy<=0.3415 -> engine<=0)
	'urn:microsoft.com/office/officeart/2024/layout/IconCircleLabelList', // Icon Circle Label List (legacy<=49.707 -> engine<=0.6401)
	'urn:microsoft.com/office/officeart/2009/3/layout/IncreasingArrowsProcess', // Increasing Arrows Process (legacy<=0.1257 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2008/layout/IncreasingCircleProcess', // Increasing Circle Process (legacy<=0.7617 -> engine<=0.1782)
	'urn:microsoft.com/office/officeart/2011/layout/InterconnectedBlockProcess', // Interconnected Block Process (legacy<=0.6136 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/rings+Icon', // Interconnected Rings (legacy<=0.0634 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/pyramid3', // Inverted Pyramid (legacy<=0.0019 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/target2', // Nested Target (legacy<=0.3991 -> engine<=0.0069)
	'urn:microsoft.com/office/officeart/2024/layout/NumberedTitleCardList', // Numbered Card List (legacy<=0.4465 -> engine<=0.2458)
	'urn:microsoft.com/office/officeart/2024/layout/NumberedTitleList', // Numbered Title List (legacy<=0.5854 -> engine<=0.3415)
	'urn:microsoft.com/office/officeart/2005/8/layout/arrow4', // Opposing Arrows (legacy<=0.2608 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2009/3/layout/OpposingIdeas', // Opposing Ideas (legacy<=0.5178 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2009/3/layout/PhasedProcess', // Phased Process (legacy<=0.3437 -> engine<=0)
	'urn:microsoft.com/office/officeart/2005/8/layout/hList2', // Picture Accent List (legacy<=0.621 -> engine<=0.2795)
	'urn:microsoft.com/office/officeart/2005/8/layout/hProcess10', // Picture Accent Process (legacy<=0.6191 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2011/layout/Picture Frame', // Picture Frame (legacy<=0.4983 -> engine<=0.4694)
	'urn:microsoft.com/office/officeart/2009/3/layout/PlusandMinus', // Plus and Minus (legacy<=0.0769 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/hProcess6', // Process Arrows (legacy<=0.4071 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/pyramid2', // Pyramid List (legacy<=0.1845 -> engine<=0.0694)
	'urn:microsoft.com/office/officeart/2011/layout/RadialPictureList', // Radial Picture List (legacy<=0.0334 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2009/layout/ReverseList', // Reverse List (legacy<=0.606 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/cycle8', // Segmented Cycle (legacy<=0.0638 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/pyramid4', // Segmented Pyramid (legacy<=0.1926 -> engine<=0)
	'urn:microsoft.com/office/officeart/2005/8/layout/vProcess5', // Staggered Process (legacy<=0.349 -> engine<=0)
	'urn:diagrams.loki3.com/TabbedArc+Icon', // Tabbed Arc (legacy<=0.2364 -> engine<=0.0131)
	'urn:microsoft.com/office/officeart/2005/8/layout/hList3', // Table List (legacy<=0.3696 -> engine<=0)
	'urn:microsoft.com/office/officeart/2026/layout/TextCardShortLineWide', // Text Card Short Line Wide (legacy<=66.8124 -> engine<=0.1482)
	'urn:microsoft.com/office/officeart/2026/layout/TextCardSideLineWideImage', // Text Card Side Line Wide Image (legacy<=73.0826 -> engine<=0.5006)
	'urn:microsoft.com/office/officeart/2011/layout/ThemePictureAccent', // Theme Picture Accent (legacy<=0.0704 -> engine<=0)
	'urn:microsoft.com/office/officeart/2011/layout/ThemePictureAlternatingAccent', // Theme Picture Alternating Accent (legacy<=0.3633 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2011/layout/ThemePictureGrid', // Theme Picture Grid (legacy<=0.3299 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2008/layout/TitledPictureBlocks', // Titled Picture Blocks (legacy<=0.474 -> engine<=0.4694)
	'urn:microsoft.com/office/officeart/2005/8/layout/hList6', // Trapezoid List (legacy<=0.2976 -> engine<=0.0012)
	'urn:microsoft.com/office/officeart/2005/8/layout/arrow2', // Upward Arrow (legacy<=0.0058 -> engine<=0.0019)
	'urn:diagrams.loki3.com/VaryingWidthList', // Varying Width List (legacy<=0.7278 -> engine<=0.654)
	'urn:microsoft.com/office/officeart/2008/layout/VerticalAccentList', // Vertical Accent List (legacy<=0.7636 -> engine<=0.2042)
	'urn:microsoft.com/office/officeart/2024/layout/VerticalActionList', // Vertical Action List (legacy<=1.0469 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/vList6', // Vertical Arrow List (legacy<=0.714 -> engine<=0.0019)
	'urn:microsoft.com/office/officeart/2005/8/layout/vList5', // Vertical Block List (legacy<=0.7692 -> engine<=0.3195)
	'urn:microsoft.com/office/officeart/2005/8/layout/chevron2', // Vertical Chevron List (legacy<=1.0901 -> engine<=0.3996)
	'urn:microsoft.com/office/officeart/2005/8/layout/vList3', // Vertical Picture Accent List (legacy<=0.489 -> engine<=0.2664)
	'urn:microsoft.com/office/officeart/2005/8/layout/vList4', // Vertical Picture List (legacy<=0.8074 -> engine<=0.0019)
]);
