<#
.SYNOPSIS
  Open a legacy binary `.ppt` file through real PowerPoint via COM and
  report every shape's `Type` plus, for shapes that have one, their
  `OLEFormat.ProgID`, machine-readable and stable.

.DESCRIPTION
  The OLE-embed counterpart to `scripts/ppt-com-hyperlinks.ps1`: proves a
  picture-frame shape opens at all (MsoShapeType 13 = msoPicture) and that
  an OLE-embedded shape (MsoShapeType 7 = msoEmbeddedOLEObject) reports the
  expected ProgID, one line per shape:

      SHAPE <index> type=<MsoShapeType> progid=<ProgID or empty>

.PARAMETER Path
  A single `.ppt` path.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Called by
  `scripts/com-acceptance-ppt.mjs`'s OLE case.
#>
param(
  [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Continue'

try {
  $app = New-Object -ComObject PowerPoint.Application
} catch {
  "FATAL PowerPoint COM is unavailable: $($_.Exception.Message)"
  exit 2
}
$app.DisplayAlerts = 1

$resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
$pres = $null
try {
  $pres = $app.Presentations.Open($resolved, $true, $false, $false)
} catch {
  "FAIL $Path  $($_.Exception.Message)"
  $app.Quit()
  exit 1
}

$slide = $pres.Slides.Item(1)
for ($i = 1; $i -le $slide.Shapes.Count; $i++) {
  $sh = $slide.Shapes.Item($i)
  $progid = ''
  try { $progid = $sh.OLEFormat.ProgID } catch { $progid = '' }
  "SHAPE $i type=$($sh.Type) progid=$progid"
}

$pres.Close()
$app.Quit()
