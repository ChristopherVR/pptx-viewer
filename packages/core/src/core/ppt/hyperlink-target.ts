/**
 * Reader-side resolved hyperlink/click-action target: the inverse of
 * `writer/write-model.ts`'s `WHyperlinkKind`, parsed from a `.ppt`'s
 * `InteractiveInfoAtom` + `ExHyperlinkContainer` records (see
 * `hyperlink-parser.ts`).
 *
 * @module ppt/hyperlink-target
 */

/** A resolved mouse-click hyperlink/action target. */
export type PptHyperlinkTarget =
	| { kind: 'url'; url: string }
	| { kind: 'slide'; slideIndex: number }
	| { kind: 'firstSlide' }
	| { kind: 'lastSlide' }
	| { kind: 'prevSlide' }
	| { kind: 'nextSlide' }
	| { kind: 'endShow' }
	| { kind: 'lastViewed' }
	| { kind: 'customShow'; name: string }
	| { kind: 'openFile'; path: string }
	| { kind: 'openPresentation'; path: string };
