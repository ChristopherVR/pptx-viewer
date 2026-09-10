<#
.SYNOPSIS
  One-off measurement (not a fixture generator): what does real PowerPoint
  16.0 itself do with a modern (DrawingML) chart when it saves a deck as
  97-2003 (.ppt)? Task-scoped for the limitations.md chart-degradation claim.

.DESCRIPTION
  Creates a presentation with one native chart (Shapes.AddChart2, the same
  object a user gets from Insert > Chart), saves it as .ppt (SaveAs format
  1 = ppSaveAsPresentation), then reopens the SAVED FILE through a second,
  independent Presentations.Open call (not the in-memory object still held
  by the first session) and reports the resulting shape's Type and, when it
  has one, OLEFormat.ProgID - the same measurement
  ppt-com-ole.ps1/com-acceptance-ppt.mjs already use for the writer's own
  OLE shapes.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Not part of any
  test run; run manually when re-verifying the limitations.md chart claim.
#>
param()

$ErrorActionPreference = 'Stop'
$outPath = Join-Path $env:TEMP 'measure-chart-ole-97.ppt'

$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1
$app.Visible = $true
try {
  $pres = $app.Presentations.Add($true)
  $slide = $pres.Slides.Add(1, 11) # ppLayoutBlank = 11
  # Style 201 (default), xlColumnClustered = 51, NewLayout = $true
  $chart = $slide.Shapes.AddChart2(201, 51, 50, 50, 400, 300, $true)

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
    $hasChart = 'n/a'
    try { $hasChart = $sh.HasChart } catch { $hasChart = '(error)' }
    "SHAPE $i type=$($sh.Type) progid=$progid hasChart=$hasChart"
  }
  $pres2.Close()
} finally {
  $app2.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app2) | Out-Null
}

"Saved+reopened: $outPath"
