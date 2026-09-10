<#
.SYNOPSIS
  One-off measurement (not a fixture generator): what does real PowerPoint
  16.0 itself do with a genuine SmartArt diagram when it saves a deck as
  97-2003 (.ppt)? Task-scoped for the limitations.md `.ppt` degradation
  row, which claims (unverified before this script) that PowerPoint keeps
  SmartArt as an editable `msoDiagram` shape on 97-2003 SaveAs. Companion
  to measure-chart-ole-97.ps1 / measure-ink-ole-97.ps1 /
  measure-model3d-ole-97.ps1, same measurement shape.

.DESCRIPTION
  Opens `packages/core/src/__tests__/fixtures/corpus/smartart-orgchart-many.pptx`
  - COM-authored via `SmartArtLayouts` (see fixture-corpus-manifest.ts):
  one manager with 6 direct reports, real SmartArt, not hand-written XML -
  reports `Shape.HasSmartArt` on the source, saves it as .ppt (SaveAs
  format 1 = ppSaveAsPresentation), then reopens the SAVED FILE through a
  second, independent Presentations.Open call and reports each shape's
  Type, HasSmartArt, and (when present) OLEFormat.ProgID.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Not part of
  any test run; run manually when re-verifying the limitations.md
  SmartArt claim. On this machine, `Application.SmartArtLayouts` returns
  an empty gallery (`Count` is null / `Object does not exist` on index
  access), so a from-scratch `Shapes.AddSmartArt` insertion could not be
  scripted here; the existing COM-authored corpus fixture is used instead.
#>
param(
  [string]$SourcePath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')) 'packages/core/src/__tests__/fixtures/corpus/smartart-orgchart-many.pptx')
)

$ErrorActionPreference = 'Stop'
$outPath = Join-Path $env:TEMP 'measure-smartart-ole-97.ppt'
$resolvedSource = (Resolve-Path -LiteralPath $SourcePath -ErrorAction Stop).Path

$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1
$app.Visible = $true
try {
  $pres = $app.Presentations.Open($resolvedSource, $true, $false, $false)
  $slide = $pres.Slides.Item(1)
  for ($i = 1; $i -le $slide.Shapes.Count; $i++) {
    $sh = $slide.Shapes.Item($i)
    $hasSmartArt = 'n/a'
    try { $hasSmartArt = $sh.HasSmartArt } catch { $hasSmartArt = '(error)' }
    "SOURCE SHAPE $i type=$($sh.Type) hasSmartArt=$hasSmartArt name=$($sh.Name)"
  }

  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  $pres.SaveAs($outPath, 1) # ppSaveAsPresentation (97-2003 .ppt)
  $pres.Close()
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}

# ---- Reopen the saved .ppt through a FRESH session and report ----
$app2 = New-Object -ComObject PowerPoint.Application
$app2.DisplayAlerts = 1
try {
  $pres2 = $app2.Presentations.Open($outPath, $true, $false, $false)
  $slide2 = $pres2.Slides.Item(1)
  for ($i = 1; $i -le $slide2.Shapes.Count; $i++) {
    $sh = $slide2.Shapes.Item($i)
    $progid = ''
    try { $progid = $sh.OLEFormat.ProgID } catch { $progid = '(none)' }
    $hasSmartArt = 'n/a'
    try { $hasSmartArt = $sh.HasSmartArt } catch { $hasSmartArt = '(error)' }
    "SHAPE $i type=$($sh.Type) hasSmartArt=$hasSmartArt progid=$progid"
  }
  $pres2.Close()
} finally {
  $app2.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app2) | Out-Null
}

"Saved+reopened: $outPath"
