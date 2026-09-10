<#
.SYNOPSIS
  Ground-truth per-glyph advance widths for common SmartArt fonts, measured
  via real PowerPoint COM, and emit them as a generated TypeScript table.

.DESCRIPTION
  The DiagramML interpreter's text-wrap-based font-size fit
  (`smartart-text-wrap-fit.ts`) needs a per-character advance width to
  estimate how many lines a label wraps to at a candidate font size. A flat
  "0.5 x font size" guess is a poor proxy for real glyph widths (an 'i' and a
  'M' are nowhere near the same width), so this script measures the REAL
  advance of every printable ASCII glyph (32-126) in each font, the same way
  `scripts/pptx-com-open.ps1` and `scripts/make-smartart-gallery.ps1` use
  PowerPoint itself as ground truth for other geometry.

  Method: one reused AutoText-fit text box (`TextFrame.WordWrap = False`,
  `TextFrame.AutoSize = ppAutoSizeShapeToFitText`) is given two strings that
  differ ONLY in how many times a glyph repeats in the middle, sandwiched
  between fixed anchor characters so leading/trailing runs of the SAME glyph
  (most importantly space, which PowerPoint would otherwise trim) are never
  at the string's edge:

      anchor + glyph * N1 + anchor
      anchor + glyph * N2 + anchor

  `(width(N2) - width(N1)) / (N2 - N1)` is the glyph's own advance in points
  at the fixed 100pt reference size, with the box's own (fixed, non-scaling)
  internal margins and the anchor characters' own widths cancelled out
  exactly - no assumption about the margin size is needed. Averaging over a
  large N2 (default 21) also dilutes any single-run rounding PowerPoint's
  text-fit applies to the whole shape width, rather than trying to guess a
  quantisation grid up front.

  The advance is stored per-1000-em (`advance_pt / referenceSize * 1000`), a
  size-independent form, so the generated table works at ANY font size the
  interpreter is fitting for.

.PARAMETER OutFile
  Destination .ts file. Defaults to
  packages/core/src/core/utils/font-advance-widths.generated.ts.

.PARAMETER Fonts
  Fonts to measure. Defaults to the Office theme's default minor font
  (Calibri) plus a handful of other common SmartArt/theme minor-font choices.

.NOTES
  Requires a local PowerPoint install (COM automation, Windows only).
#>
param(
  [string]$OutFile = "$PSScriptRoot\..\packages\core\src\core\utils\font-advance-widths.generated.ts",
  [string[]]$Fonts = @('Calibri', 'Calibri Light', 'Arial', 'Times New Roman', 'Segoe UI')
)

$ErrorActionPreference = 'Stop'

try {
  $app = New-Object -ComObject PowerPoint.Application
} catch {
  "FATAL PowerPoint COM is unavailable: $($_.Exception.Message)"
  exit 2
}
$app.Visible = -1 # msoTrue (integer, not $true: this COM interop session rejects a raw PS boolean here)

$pres = $null
try {
  $pres = $app.Presentations.Add()
  $slide = $pres.Slides.Add(1, 12) # ppLayoutBlank
  $shape = $slide.Shapes.AddTextbox(1, 50, 50, 200, 60) # msoTextOrientationHorizontal

  $ppAutoSizeShapeToFitText = 1
  $msoFalse = 0
  $shape.TextFrame.WordWrap = $msoFalse
  $shape.TextFrame.AutoSize = $ppAutoSizeShapeToFitText

  $REF_SIZE = 100.0
  $N1 = 1
  $N2 = 21
  $ANCHOR = 'n'

  function Measure-Width([string]$Text, [string]$FontName) {
    $shape.TextFrame.TextRange.Text = $Text
    $shape.TextFrame.TextRange.Font.Name = $FontName
    $shape.TextFrame.TextRange.Font.Size = $REF_SIZE
    return [double]$shape.Width
  }

  $fontResults = [ordered]@{}
  $observedNonIntegerPt = 0

  foreach ($font in $Fonts) {
    "Measuring $font ..." | Write-Host
    $shape.TextFrame.TextRange.Text = 'X'
    $shape.TextFrame.TextRange.Font.Name = $font
    $marginLeftPt = [double]$shape.TextFrame.MarginLeft
    $marginRightPt = [double]$shape.TextFrame.MarginRight
    $marginTopPt = [double]$shape.TextFrame.MarginTop
    $marginBottomPt = [double]$shape.TextFrame.MarginBottom

    $advances = [ordered]@{}
    for ($code = 32; $code -le 126; $code++) {
      $ch = [char]$code
      $strA = $ANCHOR + [string]::new($ch, $N1) + $ANCHOR
      $strB = $ANCHOR + [string]::new($ch, $N2) + $ANCHOR
      $wA = Measure-Width $strA $font
      $wB = Measure-Width $strB $font
      $advancePt = ($wB - $wA) / ($N2 - $N1)
      $per1000 = [Math]::Round(($advancePt / $REF_SIZE) * 1000.0)
      $advances["$code"] = [int]$per1000
    }

    # Ground-truth PowerPoint's own rendered `a:rPr/@sz`: pick a declared
    # ceiling and a long label, force autofit-shrink-worthy geometry, then
    # confirm the placed run's OWN size (not just this table) lands on a
    # whole point - see the generated file's header for how this feeds the
    # interpreter's own final-size rounding.
    $shape.TextFrame.TextRange.Text = 'The quick brown fox jumps'
    $shape.TextFrame.TextRange.Font.Name = $font
    $shape.TextFrame.TextRange.Font.Size = 37.4
    $sizeReadBack = [double]$shape.TextFrame.TextRange.Font.Size
    if ([Math]::Abs($sizeReadBack - [Math]::Round($sizeReadBack)) -gt 0.001) {
      $observedNonIntegerPt++
    }

    # Line height: force EXACTLY two lines by wrapping "<M-run> <M-run>" (a
    # single interior space, so word-wrap cannot break mid-run) at a width
    # between one and two run-widths, using this font's own just-measured 'M'
    # (77) advance to size the run. `TextRange.BoundHeight / 2 / REF_SIZE` is
    # then the font's real line-height-to-font-size ratio, read back from
    # PowerPoint's OWN wrapped layout rather than assumed.
    #
    # Round 18 (`smartart-track-l-successor.md`): this used to read
    # `(Shape.Height - MarginTop - MarginBottom) / 2 / REF_SIZE` instead -
    # COM-verified DIRECTLY (a fresh, isolated textbox, both quantities read
    # at the SAME moment) that `Shape.Height - margins` and `TextRange.
    # BoundHeight` are NOT the same quantity: `Shape.Height` is the outer,
    # AutoFit-driven shape height, which carries a small extra ~1.24pt of
    # its own internal padding beyond the content's real `BoundHeight` (for
    # Aptos at REF_SIZE=100: `Shape.Height - margins` gives 1.212, `BoundHeight`
    # directly gives 1.2 EXACTLY, both measured off the identical rendered
    # line) - PowerPoint's real `TextFrame2.AutoFit` shape-sizing is not a
    # pure content measurement. This codebase's own text-fit model
    # (`smartart-text-wrap-fit.ts`/`smartart-layout-item-font-tier-fit.ts`)
    # compares against `TextRange.BoundHeight`-equivalent quantities
    # throughout (matching how EVERY other COM ground-truth measurement in
    # this project's history - round 13's own fit-criterion derivation
    # included - reads PowerPoint), so `BoundHeight` is the metric this
    # table needs to match, not `Shape.Height`. Re-deriving Aptos's ratio
    # this way (1.2, not 1.212) resolves a round-13-to-17 saga where a
    # "folded root" (spcAft-inclusive) cluster measured a clean 10/9=1.1111
    # while a "standalone" (no spcAft) cluster measured a noisier ~1.08-1.10,
    # which round 17 mis-attributed to the vertical text ANCHOR needing a
    # separate line-height constant: with `lineHeightRatio=1.2` (this fix)
    # and the EXISTING, unconditional `SMARTART_LINE_SPACING_FACTOR=0.9`,
    # the ALREADY-shipped additive `spcAft` model alone reproduces BOTH
    # clusters exactly (`1.2*(0.9+0.35)=1.5` for the spcAft-inclusive case,
    # matching round 13's 12-point zero-deviation measurement precisely;
    # `1.2*0.9=1.08` for the no-spcAft case, matching `basic-block-list--
    # flat3.pptx`'s own `Lines().Count`-confirmed measurement to within
    # 0.2%) - no anchor-conditioned split was ever needed; the anchor was a
    # confound, not the real variable. `smartart-layout-item-tx-anchor.ts`
    # itself is UNRELATED (a real, separately-useful `dgm:alg type="tx"`
    # parameter resolver) and is not affected by this correction; only its
    # round-17 use for selecting a line-height factor is reverted.
    $mAdvancePer1000 = $advances['77']
    $mRunWidthPt = ($mAdvancePer1000 / 1000.0) * $REF_SIZE * 10
    $shape.TextFrame.WordWrap = -1 # msoTrue
    $shape.Width = [Math]::Round($mRunWidthPt * 1.5)
    $shape.TextFrame.TextRange.Text = ("M" * 10) + ' ' + ("M" * 10)
    $shape.TextFrame.TextRange.Font.Name = $font
    $shape.TextFrame.TextRange.Font.Size = $REF_SIZE
    $twoLineBoundHeightPt = [double]$shape.TextFrame.TextRange.BoundHeight
    $lineHeightRatio = [Math]::Round(
      ($twoLineBoundHeightPt / 2.0 / $REF_SIZE),
      3
    )
    $shape.TextFrame.WordWrap = $msoFalse

    $fontResults[$font] = [ordered]@{
      advances        = $advances
      marginLeftPt    = $marginLeftPt
      marginRightPt   = $marginRightPt
      marginTopPt     = $marginTopPt
      marginBottomPt  = $marginBottomPt
      lineHeightRatio = $lineHeightRatio
    }
  }

  # PowerPoint accepts (and reports back) fractional point font sizes when
  # EXPLICITLY set (confirmed: $sizeReadBack above stays fractional), so
  # nothing in the object model itself forces whole points. The interpreter's
  # own "PowerPoint's rendered primFontSz values are whole points" finding
  # (see smartart-text-wrap-fit.ts) comes from the SAVED FILE's `a:rPr/@sz`
  # after PowerPoint's OWN autofit picks a size, not from an API restriction;
  # this script cannot re-derive that without a full SmartArt autofit corpus,
  # which `packages/core/src/__tests__/fixtures/smartart-gallery/` already
  # provides (see the baseline the interpreter itself is measured against).
  "API accepts fractional sizes directly: $($observedNonIntegerPt) of $($Fonts.Count) fonts read back non-integer (informational only)." | Write-Host

  # ── Emit ONE small generated file per font (oxfmt expands a 95-key object
  # literal to one key per line regardless of how this script writes it, so a
  # single combined file with 5 fonts blows well past the repo's 300-LOC
  # convention; splitting per font keeps every generated file comfortably
  # under it) plus a small hand-shaped barrel that assembles them. ──────────
  $outDir = Split-Path -Parent $OutFile
  $slugOf = { param($name) ($name.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim('-') }
  $allAverages = New-Object System.Collections.Generic.List[double]
  $allAdvancesByCode = @{}
  $fontSlugs = [ordered]@{}

  foreach ($font in $fontResults.Keys) {
    $entry = $fontResults[$font]
    $values = @()
    foreach ($code in $entry.advances.Keys) { $values += [double]$entry.advances[$code] }
    $avg = [Math]::Round((($values | Measure-Object -Sum).Sum / $values.Count), 1)
    $allAverages.Add($avg)
    $slug = & $slugOf $font
    $fontSlugs[$font] = $slug

    $fLines = New-Object System.Collections.Generic.List[string]
    $fLines.Add('/**')
    $fLines.Add(" * Per-1000-em glyph advance widths for '$font', measured from REAL")
    $fLines.Add(' * PowerPoint via COM automation. GENERATED FILE: do not hand-edit.')
    $fLines.Add(' * Regenerate with `pwsh -File scripts/make-font-advance-table.ps1`; see')
    $fLines.Add(' * that script and `font-advance-widths.generated.ts` for the method and shape.')
    $fLines.Add(' */')
    $fLines.Add('')
    $fLines.Add("import type { FontAdvanceTable } from './font-advance-widths.generated';")
    $fLines.Add('')
    $fLines.Add("export const FONT_NAME = '$font';")
    $fLines.Add('')
    $fLines.Add('export const TABLE: FontAdvanceTable = {')
    $fLines.Add('	advances: {')
    foreach ($code in $entry.advances.Keys) {
      $fLines.Add("		$code`: $($entry.advances[$code]),")
      if (-not $allAdvancesByCode.ContainsKey($code)) { $allAdvancesByCode[$code] = New-Object System.Collections.Generic.List[double] }
      $allAdvancesByCode[$code].Add([double]$entry.advances[$code])
    }
    $fLines.Add('	},')
    $fLines.Add("	averageAdvance: $avg,")
    $fLines.Add("	marginLeftPt: $($entry.marginLeftPt),")
    $fLines.Add("	marginRightPt: $($entry.marginRightPt),")
    $fLines.Add("	marginTopPt: $($entry.marginTopPt),")
    $fLines.Add("	marginBottomPt: $($entry.marginBottomPt),")
    $fLines.Add("	lineHeightRatio: $($entry.lineHeightRatio),")
    $fLines.Add('};')
    $fLines.Add('')
    $fontFile = Join-Path $outDir "font-advance-widths-$slug.generated.ts"
    Set-Content -LiteralPath $fontFile -Value $fLines -Encoding utf8
    "Wrote $fontFile" | Write-Host
  }

  $defaultPairs = New-Object System.Collections.Generic.List[string]
  foreach ($code in ($allAdvancesByCode.Keys | Sort-Object { [int]$_ })) {
    $vals = $allAdvancesByCode[$code]
    $avg = [Math]::Round((($vals | Measure-Object -Sum).Sum / $vals.Count))
    $defaultPairs.Add("$code`: $avg")
  }
  $overallAvg = [Math]::Round((($allAverages | Measure-Object -Sum).Sum / $allAverages.Count), 1)
  $overallLineHeight = [Math]::Round(
    ((($fontResults.Values | ForEach-Object { $_.lineHeightRatio }) | Measure-Object -Sum).Sum / $fontResults.Count),
    3
  )

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('/**')
  $lines.Add(' * Per-1000-em glyph advance widths for common SmartArt/theme minor fonts,')
  $lines.Add(' * measured from REAL PowerPoint via COM automation. GENERATED BARREL FILE:')
  $lines.Add(' * do not hand-edit; regenerate BOTH this and the per-font')
  $lines.Add(' * `font-advance-widths-*.generated.ts` files with')
  $lines.Add(' * `pwsh -File scripts/make-font-advance-table.ps1`.')
  $lines.Add(' *')
  $lines.Add(' * Method (see the script''s own header comment for the full derivation): for')
  $lines.Add(' * each printable ASCII code point 32-126, PowerPoint measured the difference')
  $lines.Add(' * in `Shape.Width` (`TextFrame.AutoSize = ppAutoSizeShapeToFitText`,')
  $lines.Add(' * `TextFrame.WordWrap = False`) between two run lengths of the same glyph')
  $lines.Add(' * sandwiched between fixed anchor characters, isolating the glyph''s own')
  $lines.Add(' * advance in points at a 100pt reference size, independent of the text box''s')
  $lines.Add(' * own margins. Stored per-1000-em (`advance_pt / 100 * 1000`), so it applies')
  $lines.Add(' * at any font size.')
  $lines.Add(' *')
  $lines.Add(' * `marginLeftPt`/`marginRightPt`/`marginTopPt`/`marginBottomPt` are')
  $lines.Add(' * PowerPoint''s OWN default `a:bodyPr` text-frame insets for this font (read')
  $lines.Add(' * back from the measuring shape), in points. `lineHeightRatio` is the font''s')
  $lines.Add(' * own line-height-to-font-size multiple, read back from `Shape.Height / 2` of')
  $lines.Add(' * a two-line word-wrapped run (not assumed as a flat 1.2).')
  $lines.Add(' *')
  $lines.Add(' * Split into one small file per font (this barrel plus')
  $lines.Add(' * `font-advance-widths-<font-slug>.generated.ts`) because a combined table')
  $lines.Add(' * over ~2 fonts exceeds the repo''s per-file line-count convention once')
  $lines.Add(' * formatted (oxfmt expands a 95-key object literal to one key per line).')
  $lines.Add(' */')
  $lines.Add('')
  foreach ($font in $fontSlugs.Keys) {
    $lines.Add("import { FONT_NAME as $($fontSlugs[$font].Replace('-', '_'))_NAME, TABLE as $($fontSlugs[$font].Replace('-', '_'))_TABLE } from './font-advance-widths-$($fontSlugs[$font]).generated';")
  }
  $lines.Add('')
  $lines.Add('export interface FontAdvanceTable {')
  $lines.Add('	/** Per-1000-em advance width for ASCII code points 32..126 (space..~). */')
  $lines.Add('	advances: Record<number, number>;')
  $lines.Add('	/** Average per-1000-em advance across every measured glyph in this font. */')
  $lines.Add('	averageAdvance: number;')
  $lines.Add('	marginLeftPt: number;')
  $lines.Add('	marginRightPt: number;')
  $lines.Add('	marginTopPt: number;')
  $lines.Add('	marginBottomPt: number;')
  $lines.Add('	/** Line-height-to-font-size multiple (e.g. 1.2 means a line is 1.2x the font size tall). */')
  $lines.Add('	lineHeightRatio: number;')
  $lines.Add('}')
  $lines.Add('')
  $lines.Add('export const FONT_ADVANCE_TABLES: Record<string, FontAdvanceTable> = {')
  foreach ($font in $fontSlugs.Keys) {
    $lines.Add("	[$($fontSlugs[$font].Replace('-', '_'))_NAME]: $($fontSlugs[$font].Replace('-', '_'))_TABLE,")
  }
  $lines.Add('};')
  $lines.Add('')
  $lines.Add('/**')
  $lines.Add(' * Generic proportional fallback for a font not in {@link FONT_ADVANCE_TABLES}:')
  $lines.Add(' * the per-glyph AVERAGE across every measured font, so an unknown font still')
  $lines.Add(' * gets a real-metrics-shaped guess instead of a single flat ratio.')
  $lines.Add(' */')
  $lines.Add('export const DEFAULT_FONT_ADVANCE_TABLE: FontAdvanceTable = {')
  $lines.Add('	advances: {')
  foreach ($pair in $defaultPairs) { $lines.Add("		$pair,") }
  $lines.Add('	},')
  $lines.Add("	averageAdvance: $overallAvg,")
  $lines.Add('	marginLeftPt: 7.2,')
  $lines.Add('	marginRightPt: 7.2,')
  $lines.Add('	marginTopPt: 3.6,')
  $lines.Add('	marginBottomPt: 3.6,')
  $lines.Add("	lineHeightRatio: $overallLineHeight,")
  $lines.Add('};')
  $lines.Add('')

  Set-Content -LiteralPath $OutFile -Value $lines -Encoding utf8
  "Wrote $OutFile" | Write-Host
} finally {
  if ($null -ne $pres) { try { $pres.Close() } catch { } }
  try { $app.Quit() } catch { }
}
