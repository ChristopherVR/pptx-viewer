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

import type { UnderlineStyle } from "./common";
import type { PptxTextWarpPreset, Text3DStyle } from "./three-d";

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
export interface TextStyle {
  fontFamily?: string;
  fontSize?: number; // in points
  /** When true, renderer should shrink text to fit the shape bounds. */
  autoFit?: boolean;
  /** Explicit autofit mode from OOXML body properties.
   * - 'shrink': `a:spAutoFit` — shrink text on overflow
   * - 'normal': `a:normAutofit` — normal auto-fit (with optional fontScale)
   * - 'none': `a:noAutofit` — explicitly no auto-fit (text overflows)
   * - undefined: no autofit element present (inherit from layout/master)
   */
  autoFitMode?: "shrink" | "normal" | "none";
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
  strikethrough?: boolean;
  /** Specific strike type: single or double from `a:rPr/@strike`. */
  strikeType?: "sngStrike" | "dblStrike";
  /** Text outline width in px (`a:rPr > a:ln/@w` in EMU). */
  textOutlineWidth?: number;
  /** Text outline colour as hex string (`a:rPr > a:ln > a:solidFill`). */
  textOutlineColor?: string;
  /** When true, the text body has no fill (`a:rPr > a:noFill`), producing hollow/outline-only text. */
  textFillNone?: boolean;
  /** Superscript/subscript baseline shift as percentage (`a:rPr/@baseline`). Positive = super, negative = sub. */
  baseline?: number;
  /** Character spacing in hundredths of a point (`a:rPr/@spc`). */
  characterSpacing?: number;
  /** Kerning threshold in hundredths of a point (`a:rPr/@kern`). 0 = none. */
  kerning?: number;
  /** Text highlight colour as hex string (`a:highlight`). */
  highlightColor?: string;
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
  align?: "left" | "center" | "right" | "justify" | "justLow" | "dist" | "thaiDist";
  vAlign?: "top" | "middle" | "bottom";
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
  textDirection?: "horizontal" | "vertical" | "vertical270" | "eaVert" | "wordArtVert" | "wordArtVertRtl" | "mongolianVert";
  /** Body column count (`a:bodyPr/@numCol`). */
  columnCount?: number;
  /** Column spacing in px (`a:bodyPr/@spcCol` in EMU). */
  columnSpacing?: number;
  /** Horizontal overflow mode from `a:bodyPr/@hOverflow`. */
  hOverflow?: "overflow" | "clip";
  /** Vertical overflow mode from `a:bodyPr/@vertOverflow`. */
  vertOverflow?: "overflow" | "clip" | "ellipsis";
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
    align: "l" | "ctr" | "r" | "dec";
    leader?: "none" | "dot" | "hyphen" | "underscore";
  }>;
  /** Body text wrapping mode from `a:bodyPr/@wrap`. */
  textWrap?: "square" | "none";
  /** Preset text warp type from `a:bodyPr/a:prstTxWarp`. */
  textWarpPreset?: PptxTextWarpPreset;
  /** Primary adjustment value for text warp (from `a:prstTxWarp/a:avLst/a:gd` with name "adj").
   *  Stored as raw OOXML 1/60000th units (e.g. 50000 = default for many presets). */
  textWarpAdj?: number;
  /** Secondary adjustment value for text warp (from `a:prstTxWarp/a:avLst/a:gd` with name "adj2").
   *  Stored as raw OOXML 1/60000th units. */
  textWarpAdj2?: number;
  /** Text capitalization style from `a:rPr/@cap`. */
  textCaps?: "all" | "small" | "none";
  /** Symbol font family from `a:sym`. */
  symbolFont?: string;
  /** East Asian font family from `a:ea`. */
  eastAsiaFont?: string;
  /** Complex Script font family from `a:cs`. */
  complexScriptFont?: string;
  /** Text language from `a:rPr/@lang`. */
  language?: string;
  /** Hyperlink mouse-over target from `a:hlinkMouseOver`. */
  hyperlinkMouseOver?: string;
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

  // ── 3D Text (from `a:bodyPr/a:sp3d`) ──

  /** 3D extrusion/bevel settings on the text body. */
  text3d?: Text3DStyle;
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
  /** Zero-based paragraph index within the text body (for auto-numbering). */
  paragraphIndex?: number;
  /** Bullet font family from `a:buFont`. */
  fontFamily?: string;
  /** Bullet size as percentage of text font size from `a:buSzPct`. */
  sizePercent?: number;
  /** Bullet size in points from `a:buSzPts`. */
  sizePts?: number;
  /** Bullet color as hex string from `a:buClr`. */
  color?: string;
  /** True when `a:buNone` explicitly suppresses bullets. */
  none?: boolean;
  /** Picture bullet: relationship ID from `a:buBlip` → `a:blip[@r:embed]`. */
  imageRelId?: string;
  /** Picture bullet: data URL of the embedded image. */
  imageDataUrl?: string;
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
  /** Raw OMML XML node for equation segments (from `a14:m` / `m:oMathPara`). */
  equationXml?: Record<string, unknown>;
  /**
   * Optional equation number for numbered equations (e.g. "(1)", "(2.3)").
   * When present, the equation is rendered centered with the number right-aligned.
   */
  equationNumber?: string;
  /** Whether this segment represents a paragraph break rather than renderable text. */
  isParagraphBreak?: boolean;
  /** Structured bullet info for the first segment of a paragraph. */
  bulletInfo?: BulletInfo;

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
}
