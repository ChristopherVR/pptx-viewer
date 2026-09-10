<#
.SYNOPSIS
  One-off measurement (not a fixture generator): what does real PowerPoint
  16.0 itself do with genuine `p14:` ink content (`p:contentPart` bound to
  an InkML part) when it saves a deck as 97-2003 (.ppt)? Task-scoped for
  the limitations.md `.ppt` degradation row: this writer does not attempt
  to write ink into a binary .ppt shape and degrades it to a picture, the
  same question already answered for charts (measure-chart-ole-97.ps1),
  audio (ppt-com-media.ps1) and 3D models (measure-model3d-ole-97.ps1).

.DESCRIPTION
  Opens `e2e/fixtures/ink-contentpart.pptx` - the corpus witness for REAL
  PowerPoint ink (see fixture-corpus-manifest.ts: two content parts,
  `Shape.Type` = 23/msoInk in PowerPoint itself, authored by injecting
  p14 ink markup into a PowerPoint-created deck and re-saving it FROM
  PowerPoint, not hand-written) - saves it as .ppt (SaveAs format 1 =
  ppSaveAsPresentation), then reopens the SAVED FILE through a second,
  independent Presentations.Open call and reports each shape's Type
  (and OLEFormat.ProgID / HasChart when present), the same measurement
  shape used by the other measure-*-ole-97.ps1 scripts.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Not part of
  any test run; run manually when re-verifying the limitations.md ink
  claim.
#>
param(
  [string]$SourcePath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')) 'e2e/fixtures/ink-contentpart.pptx')
)

$ErrorActionPreference = 'Stop'
$outPath = Join-Path $env:TEMP 'measure-ink-ole-97.ppt'
$resolvedSource = (Resolve-Path -LiteralPath $SourcePath -ErrorAction Stop).Path

$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1
$app.Visible = $true
try {
  $pres = $app.Presentations.Open($resolvedSource, $true, $false, $false)
  $slide = $pres.Slides.Item(1)
  for ($i = 1; $i -le $slide.Shapes.Count; $i++) {
    $sh = $slide.Shapes.Item($i)
    "SOURCE SHAPE $i type=$($sh.Type) name=$($sh.Name)"
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
  for ($s = 1; $s -le $pres2.Slides.Count; $s++) {
    $slide2 = $pres2.Slides.Item($s)
    for ($i = 1; $i -le $slide2.Shapes.Count; $i++) {
      $sh = $slide2.Shapes.Item($i)
      $progid = ''
      try { $progid = $sh.OLEFormat.ProgID } catch { $progid = '(none)' }
      $hasChart = 'n/a'
      try { $hasChart = $sh.HasChart } catch { $hasChart = '(error)' }
      "SLIDE $s SHAPE $i type=$($sh.Type) progid=$progid hasChart=$hasChart"
    }
  }
  $pres2.Close()
} finally {
  $app2.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app2) | Out-Null
}

"Saved+reopened: $outPath"
