/**
 * Text-related types: rich text styles, bullet metadata, and text segments.
 *
 * These types model the contents of `<a:r>`, `<a:rPr>`, `<a:pPr>`,
 * and `<a:bodyPr>` nodes from the OpenXML Drawing namespace.
 *
 * @module pptx-types/text
 */

// ==========================================================================
// Text types: TextStyle, BulletInfo, TextSegment
// ==========================================================================

import type { PptxThemeColorRef } from './color-ref';
import type { UnderlineStyle, XmlObject } from './common';
import type { EffectDagContainer } from './effect-dag';
import type { Pptx3DScene, PptxTextWarpPreset, Text3DStyle } from './three-d';

/**
 * Rich text style properties for a text run or paragraph.
 *
 * Combines character-level formatting (font, bold, colour …),
 * paragraph-level controls (alignment, spacing, indentation), and
 * body-level properties (autofit, insets, text direction). All
 * fields are optional — unset properties inherit from layout/master
 * placeholders or theme defaults.
 *
 * @remarks
 * Font sizes are stored in **points**. Spatial measurements (insets,
 * margins) are in **pixels** (pre-converted from EMU during parsing).
 *
 * @example
 * ```ts
 * const heading: TextStyle = {
 *   fontFamily: "Montserrat",
 *   fontSize: 36,
 *   bold: true,
 *   color: "#1A1A2E",
 *   align: "center",
 *   lineSpacing: 1.15,
 * };
 *
 * const body: TextStyle = {
 *   fontFamily: "Open Sans",
 *   fontSize: 14,
 *   color: "#444444",
 *   align: "left",
 *   paragraphSpacingAfter: 8,
 * };
 * // => both satisfy the TextStyle interface
 * ```
 */
/** 2D linear transform matrix `[a, b, c, d]` for inherited group orientation. */
export type TextOrientationMatrix = [number, number, number, number];

export interface TextStyle {
	/**
	 * Combined rotation/flip matrix inherited from ancestor groups.
	 * Used only to keep descendant text readable after nested group mirrors.
	 */
	ancestorGroupTransform?: TextOrientationMatrix;
	/** Original `a:rPr` XML retained by projections that share the shape-text model. */
	runPropertiesXml?: XmlObject;
	/**
	 * The properties this run's OWN `a:rPr` authored, and nothing else.
	 *
	 * A run style is assembled as
	 * `{...inheritedRunStyle, ...authoredRunStyle}`, so the flat style is a
	 * fully RESOLVED view: it cannot say whether `fontSize: 60` came from the
	 * run, from the shape's `a:lstStyle`, from the layout placeholder, from the
	 * master `p:txStyles` or from the theme. Omission is meaningful in OOXML
	 * (§21.1.2.3), so a writer that re-emits the resolved view converts every
	 * inherited value into an authored one and the deck stops being
	 * theme-driven after one save.
	 *
	 * This is the run-scope twin of {@link TextSegment.paragraphProperties},
	 * which is parsed strictly from the paragraph's own `a:pPr` for the same
	 * reason. Present only for runs that came from a parsed deck; absent for
	 * SDK-built text, where the flat style IS the only description and must be
	 * written out in full.
	 */
	authoredRunStyle?: TextStyle;
	/**
	 * The resolved inheritance baseline {@link authoredRunStyle} was layered
	 * on top of (shape `a:lstStyle` -> placeholder -> layout -> master
	 * `p:txStyles` -> theme -> `p:defaultTextStyle`).
	 *
	 * Kept alongside the authored half because the two answer different
	 * questions. The authored half says "the source pinned this"; the baseline
	 * says "this value is what inheritance already produces", which is how an
	 * EDIT is told apart from an inherited value: an editor mutates the flat
	 * style without knowing about either field, so a property that now differs
	 * from the baseline was either authored or edited and must be written,
	 * while one that still matches can be left to inherit.
	 *
	 * Holds a reference to the per-paragraph baseline object rather than a
	 * copy, so carrying it costs one pointer per run.
	 */
	inheritedRunStyle?: TextStyle;
	/**
	 * Snapshot of the ELEMENT-scope paragraph geometry (alignment, margins,
	 * indent, line and paragraph spacing, tab stops, rtl, line-break flags) as
	 * the load pipeline resolved it.
	 *
	 * Present only on an `element.textStyle` that came from a parsed deck, and
	 * populated only with the geometry keys. It exists so the save path can
	 * answer one question it otherwise cannot: has the user CHANGED the body's
	 * alignment or indent, or is the value simply what the shape's
	 * `a:lstStyle`, its layout placeholder and the master already produce?
	 * Element-level text panels (`textAdvancedPatch`, `alignPatch` and friends
	 * in `pptx-viewer-shared`) write `element.textStyle` and never touch
	 * `segment.paragraphProperties`, so a diff against this snapshot is the
	 * only way to tell an edit from an inheritance artefact.
	 *
	 * @see element-paragraph-geometry.ts
	 */
	resolvedParagraphGeometry?: TextStyle;
	/**
	 * Snapshot of the ELEMENT-scope `a:bodyPr` properties (vertical anchor,
	 * text direction, columns, overflow, autofit, body insets, text wrap, and
	 * the boolean/rotation attributes) as the load pipeline resolved them.
	 *
	 * A shape's own `a:bodyPr` is parsed first, then whatever it left
	 * `undefined` is back-filled from the placeholder / layout / master
	 * defaults (`applyPlaceholderBodyDefaults`), and a placeholder shape with
	 * no `a:bodyPr` of its own has the INHERITED one parsed as if it were its
	 * own. None of those three sources is distinguishable at
	 * `element.textStyle` once the cascade finishes, so a writer that
	 * re-emits every defined field turns an inherited anchor, inset, autofit
	 * mode or `rtlCol` into a value pinned on the slide forever (and an
	 * inherited `a:normAutofit` with no scale gets written back as
	 * `a:spAutoFit`, flipping AutoSize from "shrink text" to "resize shape").
	 *
	 * Present only on an `element.textStyle` that came from a parsed deck.
	 * The save path diffs the live style against this snapshot: a field that
	 * still matches is an inheritance artefact and the writer leaves the
	 * underlying `a:bodyPr` attribute untouched (whatever it already is,
	 * present or absent); a field that differs was authored or has since
	 * been edited and is written out.
	 *
	 * @see element-body-properties.ts
	 */
	resolvedBodyProperties?: TextStyle;
	fontFamily?: string;
	fontSize?: number; // in points
	/** When true, some form of autofit is in effect; see {@link autoFitMode} for which. */
	autoFit?: boolean;
	/** Explicit autofit mode from OOXML body properties.
	 * - 'shrink': `a:spAutoFit` - resize the SHAPE to fit the text (never the font)
	 * - 'normal': `a:normAutofit` - shrink the TEXT to fit the shape (via `fontScale`/`lnSpcReduction`)
	 * - 'none': `a:noAutofit` - explicitly no auto-fit (text overflows)
	 * - undefined: no autofit element present (inherit from layout/master)
	 */
	autoFitMode?: 'shrink' | 'normal' | 'none';
	/** Font scale percentage for normAutofit (e.g. 0.9 = 90%). Only meaningful when autoFit is true. */
	autoFitFontScale?: number;
	/** Line spacing reduction for normAutofit (e.g. 0.2 = reduce by 20%). Only meaningful when autoFit is true. */
	autoFitLineSpacingReduction?: number;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	/** Specific underline style (e.g. "sng", "dbl", "wavy"). Falls back to "sng" when `underline` is true. */
	underlineStyle?: UnderlineStyle;
	/** Underline colour as hex string (`a:uFill` / `a:uLn`). When absent, inherits text colour. */
	underlineColor?: string;
	/**
	 * When true, the source authored `<a:u val="none"/>` to explicitly suppress
	 * underline (rather than omitting the attribute entirely). Preserved so the
	 * writer can re-emit the explicit `none` token instead of dropping it.
	 */
	underlineExplicitNone?: boolean;
	/**
	 * Underline line properties parsed from `<a:rPr><a:uLn>` — width, dash
	 * preset, and end caps. Captured as a typed object so the writer can
	 * round-trip the line styling that previously was dropped (only the
	 * solidFill colour was carried before).
	 */
	underlineLine?: {
		/** Line width in EMU (raw OOXML) for `a:uLn/@w`. */
		widthEmu?: number;
		/** Compound line type (`a:uLn/@cmpd`). */
		compound?: string;
		/** Cap style (`a:uLn/@cap`). */
		cap?: string;
		/** Pen alignment (`a:uLn/@algn`). */
		algn?: string;
		/** Preset dash value (`a:uLn/a:prstDash/@val`). */
		prstDash?: string;
		/** Raw `a:uLn/a:headEnd` XML preserved verbatim. */
		headEndXml?: XmlObject;
		/** Raw `a:uLn/a:tailEnd` XML preserved verbatim. */
		tailEndXml?: XmlObject;
	};
	/** When `<a:uLnTx/>` is present — underline line follows the text run line. */
	underlineLineFollowsText?: boolean;
	/** When `<a:uFillTx/>` is present — underline fill follows the text run fill. */
	underlineFillFollowsText?: boolean;
	strikethrough?: boolean;
	/** Specific strike type: single or double from `a:rPr/@strike`. */
	strikeType?: 'sngStrike' | 'dblStrike';
	/** Text outline width in px (`a:rPr > a:ln/@w` in EMU). */
	textOutlineWidth?: number;
	/** Text outline colour as hex string (`a:rPr > a:ln > a:solidFill`). */
	textOutlineColor?: string;
	/** Text outline dash preset (`a:rPr > a:ln > a:prstDash/@val`), e.g. `dash`; absent for solid. */
	textOutlineDash?: string;
	/** When true, the text body has no fill (`a:rPr > a:noFill`), producing hollow/outline-only text. */
	textFillNone?: boolean;
	/**
	 * When true, the run authored an EMPTY `<a:effectLst/>`: an explicit "no
	 * effects" override that blocks an inherited shadow or glow. Kept so a
	 * rewrite re-emits it instead of letting the inherited effect return.
	 */
	textEffectsExplicitNone?: boolean;
	/** Superscript/subscript baseline shift as percentage (`a:rPr/@baseline`). Positive = super, negative = sub. */
	baseline?: number;
	/** Character spacing in hundredths of a point (`a:rPr/@spc`). */
	characterSpacing?: number;
	/** Kerning threshold in hundredths of a point (`a:rPr/@kern`). 0 = none. */
	kerning?: number;
	/** Text highlight colour as hex string (`a:highlight`). */
	highlightColor?: string;
	/**
	 * Raw colour-choice XML preserved from `a:highlight` so a themed highlight
	 * (`a:schemeClr` / `a:sysClr` / `a:prstClr`) re-emits with its original
	 * identity rather than being flattened to `<a:srgbClr/>` on save. On save we
	 * re-emit verbatim when the resolved {@link highlightColor} still matches.
	 */
	highlightColorXml?: XmlObject;
	/** Text-level gradient fill CSS string (from `a:rPr > a:gradFill`). */
	textFillGradient?: string;
	/** Structured gradient stops for text fill round-trip serialization. */
	textFillGradientStops?: Array<{
		color: string;
		position: number;
		opacity?: number;
	}>;
	/** Gradient angle in degrees for text fill round-trip. */
	textFillGradientAngle?: number;
	/** Gradient type for text fill round-trip ('linear' | 'radial'). */
	textFillGradientType?: 'linear' | 'radial';
	/** Text-level pattern fill preset (from `a:rPr > a:pattFill`). */
	textFillPattern?: string;
	/** Text-level pattern foreground colour. */
	textFillPatternForeground?: string;
	/** Text-level pattern background colour. */
	textFillPatternBackground?: string;
	/**
	 * Raw `a:rPr > a:blipFill` XML, preserved verbatim for round-trip
	 * serialization AND as the input to the image resolution pass that fills
	 * in {@link textFillBlipUrl} (parsing a run's fill happens synchronously,
	 * with no zip/relationship access at that point; resolving the blip to a
	 * displayable URL needs both, so it happens in a later async pass over
	 * the slide's parsed elements, mirroring how a shape's OWN image fill is
	 * resolved). A picture-filled text run (`a:rPr > a:blipFill`) was
	 * documented as handled ("Handles gradient fills, pattern fills, and
	 * image fills on text runs") but never actually parsed, so it silently
	 * fell through to the run's plain `color` and rendered solid black
	 * (COM-verified: `audit-text` slide 13's "PICTURE FILL" run shows the
	 * fill image through the glyphs in PowerPoint).
	 */
	textFillBlipXml?: XmlObject;
	/** Resolved displayable URL for {@link textFillBlipXml}, or the archive-relative path when unresolved (lazy decode). */
	textFillBlipUrl?: string;
	/** Tiling mode for {@link textFillBlipUrl} (`a:blipFill/a:tile` present -> 'tile', else 'stretch'). */
	textFillBlipMode?: 'stretch' | 'tile';
	hyperlink?: string;
	/** Relationship ID for the hyperlink (`a:hlinkClick/@r:id`) — preserved for round-trip serialization. */
	hyperlinkRId?: string;
	/** Hyperlink tooltip text (`a:hlinkClick/@tooltip`). */
	hyperlinkTooltip?: string;
	/** Hyperlink action type (`a:hlinkClick/@action`). */
	hyperlinkAction?: string;
	/** Whether the hyperlink target is an internal slide jump (targetSlideIndex style). */
	hyperlinkTargetSlideIndex?: number;
	color?: string; // hex color
	/**
	 * Raw XML colour-choice node preserved from `a:rPr/a:solidFill` for
	 * round-trip serialisation. Captures `a:schemeClr` / `a:sysClr` /
	 * `a:prstClr` / `a:srgbClr` plus colour transforms. On save we re-emit
	 * verbatim when the resolved {@link color} still matches this node.
	 */
	colorXml?: XmlObject;
	/**
	 * Typed theme colour reference for the run's text colour, set when
	 * {@link colorXml} is a plain `a:schemeClr` (see
	 * `themeColorRefFromColorChoice`). When present it WINS on save: the
	 * writer emits `<a:schemeClr>` from this ref instead of the resolved
	 * {@link color}, so the text keeps following the theme palette after a
	 * later theme change.
	 */
	colorRef?: PptxThemeColorRef;
	align?: 'left' | 'center' | 'right' | 'justify' | 'justLow' | 'dist' | 'thaiDist';
	/**
	 * Vertical text-box anchor (`a:bodyPr/@anchor`, `ST_TextAnchoringType`).
	 * `distributed`/`justified` (`dist`/`just`) stretch line spacing so the
	 * paragraph block fills the box's full vertical extent, distinct from true
	 * centering (`middle`/`ctr`); both approximate to a middle-anchored render
	 * (see `text-body-layout.ts`) since CSS has no native vertical-justify
	 * primitive, but round-trip losslessly through parse/save.
	 */
	vAlign?: 'top' | 'middle' | 'bottom' | 'distributed' | 'justified';
	/** Right-to-left paragraph/run direction (`a:pPr/@rtl`, `a:rPr/@rtl`). */
	rtl?: boolean;
	/** Body text direction (`a:bodyPr/@vert`).
	 *
	 * Values map to OOXML `a:bodyPr/@vert` attribute values:
	 * - `"horizontal"` — default horizontal text (`horz`)
	 * - `"vertical"` — standard vertical text, right-to-left columns (`vert`)
	 * - `"vertical270"` — text rotated 270 degrees (`vert270`)
	 * - `"eaVert"` — East Asian vertical text with CJK glyphs upright (`eaVert`)
	 * - `"wordArtVert"` — WordArt vertical, each character upright stacked (`wordArtVert`)
	 * - `"wordArtVertRtl"` — WordArt vertical, right-to-left direction (`wordArtVertRtl`)
	 * - `"mongolianVert"` — Mongolian vertical text, left-to-right columns (`mongolianVert`)
	 */
	textDirection?:
		| 'horizontal'
		| 'vertical'
		| 'vertical270'
		| 'eaVert'
		| 'wordArtVert'
		| 'wordArtVertRtl'
		| 'mongolianVert';
	/** Body column count (`a:bodyPr/@numCol`). */
	columnCount?: number;
	/** Column spacing in px (`a:bodyPr/@spcCol` in EMU). */
	columnSpacing?: number;
	/** Horizontal overflow mode from `a:bodyPr/@hOverflow`. */
	hOverflow?: 'overflow' | 'clip';
	/** Vertical overflow mode from `a:bodyPr/@vertOverflow`. */
	vertOverflow?: 'overflow' | 'clip' | 'ellipsis';
	/** Body text left inset in px (`a:bodyPr/@lIns` in EMU). */
	bodyInsetLeft?: number;
	/** Body text top inset in px (`a:bodyPr/@tIns` in EMU). */
	bodyInsetTop?: number;
	/** Body text right inset in px (`a:bodyPr/@rIns` in EMU). */
	bodyInsetRight?: number;
	/** Body text bottom inset in px (`a:bodyPr/@bIns` in EMU). */
	bodyInsetBottom?: number;
	/** Paragraph spacing before in px. */
	paragraphSpacingBefore?: number;
	/** Paragraph spacing after in px. */
	paragraphSpacingAfter?: number;
	/** Line spacing multiplier (e.g. 1.2 = 120%). Used when mode is proportional (spcPct). */
	lineSpacing?: number;
	/** Exact line spacing in points (from `a:lnSpc > a:spcPts`). Takes priority over `lineSpacing` when set. */
	lineSpacingExactPt?: number;
	/** Paragraph left margin in px (`a:pPr/@marL` in EMU). */
	paragraphMarginLeft?: number;
	/** Paragraph right margin in px (`a:pPr/@marR` in EMU). */
	paragraphMarginRight?: number;
	/** Paragraph first-line indent in px (`a:pPr/@indent` in EMU). */
	paragraphIndent?: number;
	/** Tab stop positions and alignments (`a:pPr/a:tabLst/a:tab`). */
	tabStops?: Array<{
		position: number;
		align: 'l' | 'ctr' | 'r' | 'dec';
		leader?: 'none' | 'dot' | 'hyphen' | 'underscore';
		/**
		 * True when the source spelled out the schema-default `@algn="l"`, so the
		 * writer re-emits it instead of treating it as an omitted default.
		 */
		alignAuthored?: boolean;
		/** True when the source spelled out the schema-default `@leader="none"`. */
		leaderAuthored?: boolean;
	}>;
	/**
	 * True when the paragraph's own `a:pPr` authored an EMPTY `<a:tabLst/>`
	 * (explicitly "no tab stops", overriding whatever the cascade would
	 * otherwise supply) rather than omitting the element entirely (inherit).
	 * fast-xml-parser gives a childless element as the empty string, so
	 * `tabLst` and no-`tabLst` are otherwise indistinguishable once `tabStops`
	 * comes back empty either way. Paragraph-scope only; not part of the
	 * element-level geometry cascade.
	 */
	tabStopsExplicitEmpty?: boolean;
	/** Body text wrapping mode from `a:bodyPr/@wrap`. */
	textWrap?: 'square' | 'none';
	/** Preset text warp type from `a:bodyPr/a:prstTxWarp`. */
	textWarpPreset?: PptxTextWarpPreset;
	/** Primary adjustment value for text warp (from `a:prstTxWarp/a:avLst/a:gd` with name "adj").
	 *  Stored as raw OOXML 1/60000th units (e.g. 50000 = default for many presets). */
	textWarpAdj?: number;
	/** Secondary adjustment value for text warp (from `a:prstTxWarp/a:avLst/a:gd` with name "adj2").
	 *  Stored as raw OOXML 1/60000th units. */
	textWarpAdj2?: number;
	/** Text capitalization style from `a:rPr/@cap`. */
	textCaps?: 'all' | 'small' | 'none';
	/**
	 * When true, the source authored `<a:rPr cap="none"/>` explicitly. This
	 * differs from {@link textCaps} = `"none"` only because the writer must
	 * preserve the explicit token rather than collapse it to omission.
	 */
	textCapsExplicitNone?: boolean;
	/** Symbol font family from `a:sym`. */
	symbolFont?: string;
	/** East Asian font family from `a:ea`. */
	eastAsiaFont?: string;
	/** Complex Script font family from `a:cs`. */
	complexScriptFont?: string;
	/**
	 * Theme-font token (`+mj-lt` / `+mn-lt` / ...) authored on `a:latin`, when
	 * present. {@link fontFamily} holds the resolved concrete face for
	 * rendering; this preserves the token linkage so the writer re-emits the
	 * token rather than the flattened face (see #84).
	 */
	latinFontThemeToken?: string;
	/** Theme-font token authored on `a:ea` (e.g. `+mn-ea`), when present. */
	eastAsiaFontThemeToken?: string;
	/** Theme-font token authored on `a:cs` (e.g. `+mn-cs`), when present. */
	complexScriptFontThemeToken?: string;
	/**
	 * Automatic per-script fallback face resolved from the theme's
	 * `<a:font script="...">` overrides for a run whose text is dominantly
	 * CJK / Arabic / Hebrew / Thai (see #83). A rendering hint only: it is not
	 * serialised back on save, so it never disturbs the round-trip typefaces.
	 */
	scriptFallbackFont?: string;
	/**
	 * Set alongside {@link scriptFallbackFont} when the resolved {@link fontFamily}
	 * came only from the paragraph/list-style/theme CASCADE (the run's own
	 * `a:rPr` authored no `a:latin`/`a:ea`/`a:cs` of its own). A run always
	 * inherits SOME font this way (typically the theme's `+mn-lt`), so without
	 * this flag `fontFamily` was indistinguishable from a run that genuinely
	 * chose that font itself, and the renderer never applied the theme's
	 * per-script override (see #83): `+mn-lt` names only the LATIN member of
	 * the font scheme and was never meant to cover text in a different
	 * dominant script. An explicit `a:latin`/`a:ea`/`a:cs` authored on the run
	 * itself still always wins; only the cascade default yields to the
	 * script-specific override.
	 */
	fontFamilyIsCascadeDefault?: boolean;
	/** Text language from `a:rPr/@lang`. */
	language?: string;
	/** Hyperlink mouse-over target from `a:hlinkMouseOver`. */
	hyperlinkMouseOver?: string;
	/**
	 * Raw `a:snd` (embedded WAV audio) child of `a:hlinkClick`, preserved
	 * verbatim (carries `@r:embed` + `@name`). Round-tripped on save so the
	 * click sound survives instead of being dropped.
	 */
	hyperlinkSoundXml?: XmlObject;
	/** Raw `a:snd` child of `a:hlinkMouseOver`, preserved verbatim for round-trip. */
	hyperlinkMouseOverSoundXml?: XmlObject;
	/** Hyperlink invalidUrl attribute (`a:hlinkClick/@invalidUrl`). */
	hyperlinkInvalidUrl?: string;
	/** Hyperlink target frame (`a:hlinkClick/@tgtFrame`). */
	hyperlinkTargetFrame?: string;
	/** Whether hyperlink history is tracked (`a:hlinkClick/@history`). */
	hyperlinkHistory?: boolean;
	/** Whether hyperlink uses highlight-click effect (`a:hlinkClick/@highlightClick`). */
	hyperlinkHighlightClick?: boolean;
	/** Whether hyperlink ends a sound (`a:hlinkClick/@endSnd`). */
	hyperlinkEndSound?: boolean;
	/**
	 * Raw `a:hlinkClick/a:extLst` child, preserved verbatim for round-trip.
	 * Carries vendor extensions this engine does not interpret, most commonly
	 * `ahyp:hlinkClr` (Microsoft's "hyperlink color" extension,
	 * `{A12FA001-AC4F-418D-AE19-62706E023703}`), which records whether a
	 * hyperlink run should paint with the theme's text colour instead of the
	 * hyperlink colour. Dropping the whole `a:extLst` silently reverted such a
	 * run to the default (themed) hyperlink colour on save.
	 */
	hyperlinkExtensionXml?: XmlObject;

	// ── Text run metadata (from `a:rPr` attributes) ──

	/** Kumimoji (ideographic text combining) flag for vertical CJK text (`a:rPr/@kumimoji`). */
	kumimoji?: boolean;
	/** Normalize height flag (`a:rPr/@normalizeH`). */
	normalizeHeight?: boolean;
	/** No proofing flag (`a:rPr/@noProof`). */
	noProof?: boolean;
	/** Dirty flag indicating run has been edited (`a:rPr/@dirty`). */
	dirty?: boolean;
	/** Error flag indicating spelling error (`a:rPr/@err`). */
	spellingError?: boolean;
	/** Smart tag clean flag (`a:rPr/@smtClean`). */
	smartTagClean?: boolean;
	/** Bookmark link target (`a:rPr/@bmk`). */
	bookmark?: string;
	/** Alternative language for the run (`a:rPr/@altLang`). Populated for runs
	 *  authored in mixed-script documents (e.g. Asian/Latin combined). */
	altLanguage?: string;
	/** SmartTag (Office grammar tag) GUID id (`a:rPr/@smtId`). Round-tripped
	 *  verbatim — the engine doesn't interpret it. */
	smartTagId?: number;

	// ── Per-script font metadata (CT_TextFont) ──
	/** Latin font PANOSE classification string from `a:rPr > a:latin/@panose`. */
	latinFontPanose?: string;
	/** Latin font pitch + family flag from `a:rPr > a:latin/@pitchFamily`. */
	latinFontPitchFamily?: number;
	/** Latin font character set id from `a:rPr > a:latin/@charset`. */
	latinFontCharset?: number;
	/** East-Asian font PANOSE from `a:rPr > a:ea/@panose`. */
	eastAsiaFontPanose?: string;
	/** East-Asian font pitch + family flag from `a:rPr > a:ea/@pitchFamily`. */
	eastAsiaFontPitchFamily?: number;
	/** East-Asian font character set id from `a:rPr > a:ea/@charset`. */
	eastAsiaFontCharset?: number;
	/** Complex-script font PANOSE from `a:rPr > a:cs/@panose`. */
	complexScriptFontPanose?: string;
	/** Complex-script font pitch + family flag from `a:rPr > a:cs/@pitchFamily`. */
	complexScriptFontPitchFamily?: number;
	/** Complex-script font character set id from `a:rPr > a:cs/@charset`. */
	complexScriptFontCharset?: number;
	/** Symbol-font PANOSE from `a:rPr > a:sym/@panose`. */
	symbolFontPanose?: string;
	/** Symbol-font pitch + family flag from `a:rPr > a:sym/@pitchFamily`. */
	symbolFontPitchFamily?: number;
	/** Symbol-font character set id from `a:rPr > a:sym/@charset`. */
	symbolFontCharset?: number;

	// ── List / bullet style ──

	/** Paragraph list type for toggling bullet / numbered lists via the toolbar.
	 * - `'bullet'` — character bullet (default "•")
	 * - `'numbered'` — auto-numbered list (arabicPeriod)
	 * - `'none'` — explicitly no list
	 */
	listType?: 'bullet' | 'numbered' | 'none';

	// ── Paragraph properties (additional) ──

	/** Default tab size in px (`a:pPr/@defTabSz` in EMU). */
	defaultTabSize?: number;
	/** East Asian line break flag (`a:pPr/@eaLnBrk`). */
	eaLineBreak?: boolean;
	/** Latin line break flag (`a:pPr/@latinLnBrk`). */
	latinLineBreak?: boolean;
	/** Font alignment (`a:pPr/@fontAlgn`): 'auto' | 'base' | 'ctr' | 't' | 'b'. */
	fontAlignment?: string;
	/** Hanging punctuation flag (`a:pPr/@hangingPunct`). */
	hangingPunctuation?: boolean;

	// ── Text body properties (additional) ──

	/** Whether to space first and last paragraph from body edges (`a:bodyPr/@spcFirstLastPara`). */
	spaceFirstLastParagraph?: boolean;
	/** Right-to-left column flow (`a:bodyPr/@rtlCol`). */
	rtlColumns?: boolean;
	/** Whether text originates from WordArt (`a:bodyPr/@fromWordArt`). */
	fromWordArt?: boolean;
	/** Whether text anchoring is centered (`a:bodyPr/@anchorCtr`). */
	anchorCenter?: boolean;
	/** Force anti-aliasing (`a:bodyPr/@forceAA`). */
	forceAntiAlias?: boolean;
	/** Upright text in 3D views (`a:bodyPr/@upright`). */
	upright?: boolean;
	/** Compatible line spacing flag (`a:bodyPr/@compatLnSpc`). */
	compatibleLineSpacing?: boolean;
	/**
	 * Text body rotation in **degrees** (`a:bodyPr/@rot`).
	 *
	 * OOXML stores the value as 60000ths of a degree. Positive values rotate
	 * the body clockwise. When undefined, the attribute is omitted on save
	 * (PowerPoint treats absent `rot` as inherit/none).
	 */
	textBodyRotation?: number;

	// ── Text run effects (from `a:rPr/a:effectLst`) ──

	/** Text shadow colour as hex string (`a:outerShdw`). */
	textShadowColor?: string;
	/** Text shadow blur radius in px. */
	textShadowBlur?: number;
	/** Text shadow horizontal offset in px. */
	textShadowOffsetX?: number;
	/** Text shadow vertical offset in px. */
	textShadowOffsetY?: number;
	/** Text shadow opacity (0-1). */
	textShadowOpacity?: number;

	/** Text inner shadow colour (`a:innerShdw`). */
	textInnerShadowColor?: string;
	/** Text inner shadow opacity (0-1). */
	textInnerShadowOpacity?: number;
	/** Text inner shadow blur radius in px. */
	textInnerShadowBlur?: number;
	/** Text inner shadow horizontal offset in px. */
	textInnerShadowOffsetX?: number;
	/** Text inner shadow vertical offset in px. */
	textInnerShadowOffsetY?: number;
	/**
	 * Original inner-shadow colour-choice XML (`a:innerShdw`'s
	 * `a:prstClr`/`a:schemeClr`/`a:srgbClr`/… child), preserved verbatim so an
	 * authored preset or theme colour round-trips instead of always being
	 * re-serialized as a resolved `a:srgbClr`. Mirrors {@link textGlowColorXml}.
	 */
	textInnerShadowColorXml?: XmlObject;
	/** Theme colour slot the inner shadow colour resolved from, when it is `a:schemeClr`. */
	textInnerShadowColorRef?: PptxThemeColorRef;

	/** Preset shadow type from `a:prstShdw/@prst` (e.g. "shdw1"..."shdw20"). */
	textPresetShadowName?: string;
	/** Preset shadow colour as hex string. */
	textPresetShadowColor?: string;
	/** Preset shadow opacity (0-1). */
	textPresetShadowOpacity?: number;
	/** Preset shadow distance in px. */
	textPresetShadowDistance?: number;
	/** Preset shadow direction in degrees. */
	textPresetShadowDirection?: number;

	/** Text blur effect radius in px (`a:blur`). */
	textBlurRadius?: number;

	/**
	 * Text soft-edge radius in px (`a:softEdge/@rad`).
	 *
	 * Feathers the glyph's own edges (a uniform blur of the alpha silhouette,
	 * the same effect a shape's `a:softEdge` gives its fill), unrelated to
	 * `a:blur` (which blurs the whole run, colour included) or a shadow. Never
	 * parsed before this field existed, so `a:softEdge` on a run was silently
	 * dropped: PowerPoint fades the glyphs to near-transparent at their
	 * outline (COM-verified, `audit-text` slide 14's "SOFTEDGE" run), while
	 * the viewer painted them fully crisp.
	 */
	textSoftEdgeRadius?: number;

	// ── Effect DAG properties (from `a:rPr/a:effectDag`) ──
	// ECMA-376 §21.1.2.3.6 lists `a:effectDag` as a valid child of
	// `CT_TextCharacterProperties`. Round-tripping it requires storing both the
	// raw XML (for unknown leaf effects) and the typed tree of structural
	// container nodes.

	/**
	 * Raw `a:effectDag` XML node from `a:rPr`, preserved verbatim for
	 * round-trip serialisation. Mirrors the shape-level
	 * {@link import('./shape-style').ShapeStyle.effectDagXml} field.
	 */
	textEffectDagXml?: XmlObject;
	/**
	 * Typed effect graph parsed from `textEffectDagXml`. The four structural
	 * container nodes (`a:cont`, `a:blend`, `a:xfrmEffect`, `a:relOff`) are
	 * fully typed; any other leaf effect is captured as
	 * {@link import('./effect-dag').EffectDagRawLeaf} so we never have to
	 * recurse into the full effect taxonomy.
	 */
	textEffectDagTree?: EffectDagContainer;

	/** Text alpha modulation fixed (0-100) from `a:alphaModFix`. */
	textAlphaModFix?: number;
	/** Text alpha modulation from `a:alphaMod` (0-100 percentage). */
	textAlphaMod?: number;

	/** Text hue shift in degrees from `a:hsl/@hue`. */
	textHslHue?: number;
	/** Text saturation adjustment from `a:hsl/@sat`. */
	textHslSaturation?: number;
	/** Text luminance adjustment from `a:hsl/@lum`. */
	textHslLuminance?: number;

	/** Text colour change from colour as hex string (`a:clrChange`). */
	textClrChangeFrom?: string;
	/** Text colour change to colour as hex string. */
	textClrChangeTo?: string;

	/** Text duotone colour pair (`a:duotone`). */
	textDuotone?: { color1: string; color2: string };

	/** Text glow colour as hex string (`a:glow`). */
	textGlowColor?: string;
	/** Text glow radius in px. */
	textGlowRadius?: number;
	/** Text glow opacity (0-1). */
	textGlowOpacity?: number;
	/**
	 * Original glow colour-choice XML (`a:glow`'s `a:schemeClr`/`a:srgbClr`/…
	 * child), preserved verbatim so a theme colour reference round-trips
	 * instead of always being re-serialized as a resolved `a:srgbClr` (which
	 * cuts the glow off from theme/Recolor changes).
	 */
	textGlowColorXml?: XmlObject;
	/** Theme colour slot the glow colour resolved from, when it is `a:schemeClr`. */
	textGlowColorRef?: PptxThemeColorRef;

	/** Text reflection enabled flag. */
	textReflection?: boolean;
	/** Text reflection blur radius in px. */
	textReflectionBlur?: number;
	/** Text reflection start opacity (0-1). */
	textReflectionStartOpacity?: number;
	/** Text reflection end opacity (0-1). */
	textReflectionEndOpacity?: number;
	/** Text reflection offset distance in px. */
	textReflectionOffset?: number;
	/**
	 * Text reflection fade direction (`a:rPr/a:effectLst/a:reflection/@fadeDir`)
	 * in degrees. Mirrors `ShapeStyle.reflectionFadeDirection`.
	 */
	textReflectionFadeDirection?: number;
	/**
	 * Text reflection horizontal scaling (`@sx`), same units as
	 * `ShapeStyle.reflectionScaleX` (1000ths of a percent, e.g. 100000 = 100%).
	 */
	textReflectionScaleX?: number;
	/** Text reflection vertical scaling (`@sy`). See `ShapeStyle.reflectionScaleY`. */
	textReflectionScaleY?: number;
	/**
	 * Text reflection horizontal skew (`@kx`) in 60000ths of a degree. See
	 * `ShapeStyle.reflectionSkewX`.
	 */
	textReflectionSkewX?: number;
	/** Text reflection vertical skew (`@ky`). See `ShapeStyle.reflectionSkewY`. */
	textReflectionSkewY?: number;
	/**
	 * Text reflection independent rotation (`@rot`) in degrees. See
	 * `ShapeStyle.reflectionRotation`.
	 */
	textReflectionRotation?: number;
	/** Text reflection anchor (`@algn`). See `ShapeStyle.reflectionAlignment`. */
	textReflectionAlignment?: 'tl' | 't' | 'tr' | 'l' | 'ctr' | 'r' | 'bl' | 'b' | 'br';

	// ── 3D Text (from `a:bodyPr/a:sp3d` and `a:bodyPr/a:scene3d`) ──

	/** 3D extrusion/bevel settings on the text body. */
	text3d?: Text3DStyle;
	/** 3D scene (camera + light rig) settings on the text body (`a:bodyPr/a:scene3d`). */
	textBodyScene3d?: Pptx3DScene;
	/** Raw `a:scene3d` subtree used to preserve extensions and unmodelled children. */
	textBodyScene3dXml?: XmlObject;
	/**
	 * `a:bodyPr/a:flatTx` - an explicit "render this text flat" marker. `sp3d`
	 * and `flatTx` are a mutually exclusive OOXML choice (`EG_Text3D`), so a
	 * shape/run that overrides an inherited 3D text body with `<a:flatTx/>`
	 * carries no `text3d` of its own; without this explicit flag a later
	 * inheritance merge has no signal to stop `text3d`/`textBodyScene3d` from
	 * an ancestor (layout/master) leaking back in, the way `noFill` stops an
	 * inherited fill. A renderer must short-circuit 3D-text application
	 * whenever this is `true`, regardless of what `text3d`/`textBodyScene3d`
	 * otherwise hold.
	 */
	flatText?: boolean;

	// ── Opaque XML preservation (extLst extension lists) ──

	/**
	 * Raw `<a:extLst>` subtree captured from `<a:bodyPr>`. Preserved verbatim so
	 * authored extensions (e.g. content placeholders, custom application data)
	 * survive a round-trip even though the engine doesn't interpret them.
	 */
	bodyPropertiesExtLstXml?: XmlObject;
	/**
	 * Raw `<a:extLst>` subtree captured from `<a:pPr>`. Only meaningful on the
	 * paragraph-level style (paragraphs propagate this via the first segment).
	 */
	paragraphPropertiesExtLstXml?: XmlObject;
	/**
	 * Raw `<a:extLst>` subtree captured from `<a:rPr>`. Persisted verbatim on
	 * save when present — covers run-level extensions the typed model doesn't
	 * model (e.g. `a14:hiddenFill` and similar).
	 */
	runPropertiesExtLstXml?: XmlObject;

	/**
	 * Raw `<a:defRPr>` XML node captured from `<a:pPr>`. The schema permits
	 * `defRPr` directly inside `pPr` so that paragraph defaults can specify the
	 * end-paragraph run formatting; previously this was dropped on save. We
	 * persist the parsed XML object so it round-trips verbatim.
	 *
	 * Only meaningful on the *first* segment of each paragraph (matches the
	 * convention used for {@link bulletInfo} / {@link endParaRunProperties}).
	 */
	paragraphDefaultRunPropertiesXml?: XmlObject;

	/**
	 * The bullet colour / size / typeface children (`a:buClrTx`, `a:buClr`,
	 * `a:buSzTx`, `a:buSzPct`, `a:buSzPts`, `a:buFontTx`, `a:buFont`) a
	 * paragraph authored in its own `<a:pPr>` WITHOUT a bullet type
	 * (`a:buNone` / `a:buChar` / `a:buAutoNum` / `a:buBlip`), captured
	 * verbatim in source order. Such a paragraph restyles an inherited bullet
	 * rather than declaring one, so its {@link BulletInfo} resolves from the
	 * cascade and is (correctly) not written back; without this capture the
	 * paragraph's own override vanished on every rewrite.
	 *
	 * Only meaningful on a paragraph's own authored properties.
	 */
	paragraphBulletPropertiesXml?: XmlObject;
}

/**
 * Structured bullet metadata attached to the first {@link TextSegment}
 * of each paragraph.
 *
 * Describes how the paragraph bullet should render: character bullets
 * (`char`), auto-numbered lists (`autoNumType`), or picture bullets
 * (`imageRelId` / `imageDataUrl`). Set `none: true` when `a:buNone`
 * explicitly suppresses the bullet.
 *
 * @example
 * ```ts
 * // Simple character bullet:
 * const bullet: BulletInfo = { char: "•", color: "#333333" };
 *
 * // Auto-numbered list starting at 1:
 * const numbered: BulletInfo = {
 *   autoNumType: "arabicPeriod",
 *   autoNumStartAt: 1,
 * };
 * // => { char: "•", color: "#333333" } and { autoNumType: "arabicPeriod", autoNumStartAt: 1 }
 * ```
 */
export interface BulletInfo {
	/** Bullet character (e.g. "•", "-", "»") from `a:buChar`. */
	char?: string;
	/** Auto-numbering type (e.g. "arabicPeriod", "romanUcPeriod") from `a:buAutoNum`. */
	autoNumType?: string;
	/** Auto-numbering start value. */
	autoNumStartAt?: number;
	/**
	 * Auto-numbering ORDINAL OFFSET: the zero-based distance of this paragraph
	 * within its own numbered list, such that
	 * `autoNumStartAt + paragraphIndex` is the ordinal to render. Despite the
	 * name it is NOT the paragraph's position in the text body; the two agree
	 * only for a list that starts at the first paragraph and is never
	 * interrupted.
	 *
	 * It has to be the offset rather than the raw position because every
	 * consumer that re-derives a marker from `BulletInfo` alone (the renderer's
	 * `resolveParagraphBullet`, the Markdown converter's `resolveListMarker`)
	 * computes `autoNumStartAt + paragraphIndex`. The load path resolves the
	 * real sequence itself, restarting the count after any paragraph that
	 * interrupts the list, and publishes the offset here so those consumers
	 * land on the same number. With the raw position they did not, and BOTH
	 * markers were painted ("3.1. Item"), because the paragraph builder drops
	 * the parsed marker segment only when the two strings agree.
	 *
	 * Runtime-only: derived at parse time and never serialized. OOXML has no
	 * counterpart (`a:buAutoNum` carries only `@type` and `@startAt`), so the
	 * writer neither reads nor emits it.
	 */
	paragraphIndex?: number;
	/** Bullet font family from `a:buFont`. */
	fontFamily?: string;
	/**
	 * PANOSE font-matching hint from `a:buFont/@panose`. `a:buFont` is a
	 * CT_TextFont, the same complex type as `a:latin`/`a:ea`/`a:cs`/`a:sym`
	 * (which carry the equivalent `TextStyle.latinFontPanose` etc.), so a
	 * bullet's own PANOSE/pitch-family/charset decide the fallback glyph
	 * PowerPoint substitutes when the named typeface is missing.
	 */
	fontPanose?: string;
	/** Font pitch-and-family byte from `a:buFont/@pitchFamily`. */
	fontPitchFamily?: number;
	/** Font character-set byte from `a:buFont/@charset`. */
	fontCharset?: number;
	/** Bullet size as percentage of text font size from `a:buSzPct`. */
	sizePercent?: number;
	/** Bullet size in points from `a:buSzPts`. */
	sizePts?: number;
	/** Bullet color as hex string from `a:buClr`. */
	color?: string;
	/**
	 * Raw colour-choice XML captured from `<a:buClr>` so that themed bullets
	 * (`a:schemeClr`, `a:sysClr`, `a:prstClr`) round-trip with their original
	 * identity rather than being flattened to `<a:srgbClr/>` on save.
	 */
	colorXml?: XmlObject;
	/**
	 * Typed theme colour reference for the bullet colour, set when
	 * {@link colorXml} is a plain `a:schemeClr`. Wins on save, same as
	 * {@link TextStyle.colorRef}.
	 */
	colorRef?: PptxThemeColorRef;
	/** True when `a:buNone` explicitly suppresses bullets. */
	none?: boolean;
	/** Picture bullet: relationship ID from `a:buBlip` → `a:blip[@r:embed]`. */
	imageRelId?: string;
	/** Picture bullet: data URL of the embedded image. */
	imageDataUrl?: string;
	/**
	 * Raw `<a:buBlip>` XML captured at parse time. Carries the full blipFill
	 * subtree (`a:tile`, `a:stretch`, `a:srcRect`, `a:blip > a:extLst`) so the
	 * writer can emit the complete original definition rather than the bare
	 * `a:blip[@r:embed]` mapping. When set, the writer prefers it over
	 * {@link imageRelId} for emission.
	 */
	imageBlipFillXml?: XmlObject;
	/** When true, `<a:buFontTx/>` was specified — inherit the bullet font from
	 *  the run text, not from a buFont declaration. */
	fontInherit?: boolean;
	/** When true, `<a:buClrTx/>` was specified — inherit the bullet colour from
	 *  the run text. */
	colorInherit?: boolean;
	/** When true, `<a:buSzTx/>` was specified — inherit the bullet size from
	 *  the run text font size. */
	sizeInherit?: boolean;
	/**
	 * True when this bullet resolution came from the paragraph's OWN `a:pPr`
	 * rather than the shape's `a:lstStyle`, an inherited placeholder, or the
	 * master's `a:defPPr` / `p:txStyles`. `resolveParagraphBulletInfo` walks
	 * that cascade and returns the first match, so without this flag a
	 * writer that re-emits every resolved `BulletInfo` in full pins an
	 * inherited bullet (e.g. a master `buFont="Arial"` / `buChar="•"`) onto
	 * every paragraph's own `a:pPr` the moment the slide is rewritten. The
	 * save path only writes the bullet group when this is `true`, mirroring
	 * how `paragraphProperties` gates every other per-paragraph field.
	 */
	ownedByParagraph?: boolean;
}

/**
 * A single text run within a paragraph.
 *
 * A text body is decomposed into an array of `TextSegment` objects,
 * each with its own style. Paragraph breaks are represented as
 * segments with `isParagraphBreak: true`.
 *
 * @example
 * ```ts
 * const segments: TextSegment[] = [
 *   { text: "Bold intro ", style: { bold: true, fontSize: 16 } },
 *   { text: "and normal text.", style: { fontSize: 16 } },
 *   { text: "", style: {}, isParagraphBreak: true },
 *   { text: "Second paragraph.", style: { fontSize: 14 } },
 * ];
 * // => 4 segments: 2 styled runs, 1 paragraph break, 1 normal run
 * ```
 */
export interface TextSegment {
	text: string;
	style: TextStyle;
	/** When this segment originated from an `a:fld` element, stores the field type (e.g. "slidenum", "datetime"). */
	fieldType?: string;
	/** When this segment originated from an `a:fld` element, stores the field GUID. */
	fieldGuid?: string;
	/**
	 * Original attribute name used to author the field GUID — `'uuid'` for the
	 * `a:fld/@uuid` form authored by some legacy producers, `'id'` for the
	 * canonical `a:fld/@id` form. Preserved so the writer round-trips whichever
	 * spelling the source used (PowerPoint accepts both). Defaults to `'id'`
	 * on save when undefined.
	 */
	fieldGuidAttr?: 'uuid' | 'id';
	/**
	 * Raw per-field paragraph properties (`a:fld > a:pPr`). The schema permits
	 * `pPr` inside an `a:fld` so the field can carry its own paragraph-level
	 * formatting; preserved verbatim on save when present.
	 */
	fieldParagraphPropertiesXml?: XmlObject;
	/** Raw OMML XML node for equation segments (from `a14:m` / `m:oMathPara`). */
	equationXml?: Record<string, unknown>;
	/**
	 * The ORIGINAL top-level paragraph child that carried this equation,
	 * captured verbatim at parse time and keyed by its own tag: `{ 'a14:m':
	 * ... }`, `{ 'm:oMathPara': ... }`, `{ 'm:oMath': ... }`, or `{
	 * 'mc:AlternateContent': ... }` for an equation authored behind a
	 * Choice/Fallback switch. `equationXml` above is the resolved math content
	 * used for rendering (unwrapped one level for `a14:m`/`mc:AlternateContent`
	 * sources); this field exists solely so the writer can re-emit an UNTOUCHED
	 * equation byte-for-byte, Choice and Fallback both, instead of collapsing
	 * it to a bare math element PowerPoint's own writer never produces.
	 * `undefined` for a freshly inserted or edited equation, which the writer
	 * instead reconstructs from `equationXml` (always `{ 'm:oMathPara': ... }`
	 * or `{ 'm:oMath': ... }` for those cases). Any code that replaces
	 * `equationXml` on an existing segment must drop this field, or the writer
	 * would keep re-emitting the equation's OLD XML instead of the edit.
	 */
	equationSourceXml?: Record<string, unknown>;
	/**
	 * Optional equation number for numbered equations (e.g. "(1)", "(2.3)").
	 * When present, the equation is rendered centered with the number right-aligned.
	 */
	equationNumber?: string;
	/** Whether this segment represents a paragraph break rather than renderable text. */
	isParagraphBreak?: boolean;
	/**
	 * Whether this segment represents a soft line break (`a:br`) rather than
	 * a paragraph terminator. Soft line breaks remain inside the same paragraph
	 * but force a line wrap and may carry their own run properties.
	 *
	 * The renderer should treat the segment text as `"\n"` when present.
	 */
	isLineBreak?: true;
	/**
	 * Raw `a:rPr` XML for an `a:br` (soft line break) segment, captured verbatim
	 * during parse so the writer can re-emit attributes/colours/fonts that the
	 * typed model doesn't represent. Only meaningful when {@link isLineBreak}
	 * is `true`.
	 */
	breakRunProperties?: Record<string, unknown>;
	/** Structured bullet info for the first segment of a paragraph. */
	bulletInfo?: BulletInfo;
	/**
	 * Outline level for the paragraph this segment starts (`a:p/@lvl`).
	 *
	 * Only meaningful on the first segment of a paragraph (matching the
	 * convention used for {@link bulletInfo}). Stored as the raw OOXML
	 * value (0 = top level, 1-8 = nested) and serialised back when non-zero.
	 */
	paragraphLevel?: number;
	/**
	 * Raw `a:endParaRPr` XML node for the paragraph this segment starts.
	 *
	 * Captured verbatim on parse so attributes and child colours/fonts that
	 * the typed model doesn't represent survive a round-trip. Only meaningful
	 * on the first segment of a paragraph.
	 */
	endParaRunProperties?: Record<string, unknown>;
	/**
	 * Resolved body defaults and optional `a:endParaRPr` of a runless paragraph.
	 * Carried on its first segment (or terminator), separately from marker
	 * styling. Absent when the source contains an authored run or field.
	 */
	paragraphInsertionStyle?: TextStyle;
	/**
	 * Per-paragraph properties (alignment, spacing, margins, indent, tab stops,
	 * rtl) authored on this paragraph's own `a:pPr` (#69). Only meaningful on
	 * the first segment of a paragraph. When present, the writer emits these
	 * per paragraph instead of collapsing one shape-level pPr onto every
	 * paragraph. Only the paragraph-geometry keys of {@link TextStyle} are
	 * populated; unrelated fields fall back to the shape-level style.
	 */
	paragraphProperties?: TextStyle;
	/**
	 * The paragraph this segment starts authored an EMPTY `<a:pPr/>`. Only
	 * meaningful on the first segment of a paragraph. The writer re-emits the
	 * empty element when it has no paragraph property of its own to write, so
	 * a rewritten slide keeps the markup PowerPoint wrote.
	 */
	emptyParagraphPropertiesAuthored?: boolean;
	/**
	 * The paragraph this segment starts has no run content and authored no
	 * `a:endParaRPr` (a bare `<a:p/>`, possibly with an `a:pPr`). Only
	 * meaningful on the first segment of a paragraph. It stops the writer
	 * inventing an empty run or an `<a:endParaRPr lang="en-US"/>` stub for a
	 * paragraph that still has no content when saved.
	 */
	bareParagraph?: boolean;

	// ── Ruby text (phonetic guides) ──

	/**
	 * Phonetic annotation text from `a:ruby > a:rt` (e.g. furigana, pinyin).
	 * When present, the renderer should wrap the base text with an HTML `<ruby>` tag.
	 */
	rubyText?: string;
	/**
	 * Ruby text alignment from `a:rubyPr > @val` attribute.
	 * Values: "ctr" (center), "l" (left), "r" (right), "dist" (distribute), "distCat", "distLetter".
	 * @default "ctr"
	 */
	rubyAlignment?: string;
	/**
	 * Ruby text font size as a percentage of the base text font size
	 * from `a:rubyPr/@hps` (half-point size) or inferred from rt run font size.
	 * Stored in **points** for consistency with `TextStyle.fontSize`.
	 */
	rubyFontSize?: number;
	/**
	 * Style for the ruby (phonetic) text run, parsed from `a:rt > a:r > a:rPr`.
	 * Used by the renderer to apply font family, colour, etc. to the `<rt>` element.
	 */
	rubyStyle?: TextStyle;
	/**
	 * The parsed `a:rubyPr` node, kept verbatim so its attributes (`hps`,
	 * `hpsRaise`, `hpsBaseText`, `lid`, ...) round-trip exactly; only an
	 * edited {@link rubyAlignment} is written over it on save.
	 */
	rubyPropertiesXml?: XmlObject;
	/**
	 * What each of a ruby run's two base-side `a:rPr`s authored on its own:
	 * `outer` is the containing `a:r`'s, `base` the `a:rubyBase` run's. The
	 * flat {@link style} merges both for rendering; these let the writer give
	 * each `a:rPr` back only its own properties (plus any later edit).
	 */
	rubyRunAuthoredStyles?: { outer?: TextStyle; base?: TextStyle };
}
