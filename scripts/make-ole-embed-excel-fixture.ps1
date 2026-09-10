<#
.SYNOPSIS
  Regenerate e2e/fixtures/ole-embed-excel.ppt: a real PowerPoint-authored
  97-2003 (.ppt) deck with a native embedded Excel worksheet
  (Excel.Sheet.8), ground truth for the legacy `.ppt` reader's OLE
  read-back (packages/core/src/core/ppt/ole-embed-parser.ts).

.DESCRIPTION
  Creates a blank presentation, adds one slide, and embeds a brand-new
  Excel worksheet object via Shapes.AddOLEObject(ClassName:="Excel.Sheet.8")
  (no source file: PowerPoint creates the embedded object directly through
  the registered Excel.Sheet.8 OLE server). Two known cell values are then
  written through OLEFormat.Object (the embedded worksheet's own automation
  object), so the fixture has content this project's own reader can verify
  byte-for-byte after import (see ole-embed-excel-fixture.test.ts, which
  reads the recovered ExOleObjStg bytes back with
  `ole-sheet-xls-biff8.ts#readOleXlsGrid`).

  The deck is saved with PpSaveAsFileType 1 (ppSaveAsPresentation: the
  PowerPoint 97-2003 binary format in a modern PowerPoint install), so the
  slide's OLE shape round-trips through the real MS-PPT ExOleEmbedContainer
  / ExOleObjStg binary records this project's writer also produces (see
  packages/core/src/core/ppt/writer/ole-writer.ts), except this time the
  nested storage is a genuine native Excel.Sheet.8 CFB rather than this
  project's own "Package" wrapper.

.NOTES
  Requires a local PowerPoint AND Excel install (Excel is the registered OLE
  server for Excel.Sheet.8). Windows + pwsh only.

.EXAMPLE
  pwsh -File scripts/make-ole-embed-excel-fixture.ps1
#>
param(
  [string]$OutPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')) 'e2e/fixtures/ole-embed-excel.ppt')
)

$ErrorActionPreference = 'Stop'

$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1
try {
  $pres = $app.Presentations.Add($false)
  $slide = $pres.Slides.Add(1, 11) # ppLayoutBlank = 11
  $shape = $slide.Shapes.AddOLEObject(50, 50, 300, 200, 'Excel.Sheet.8')

  # OLEFormat.Object for a from-scratch Excel.Sheet.8 embed is the Workbook
  # automation object (its .Name reads "Book1"), NOT a Worksheet directly:
  # .Range must go through .ActiveSheet.
  $workbook = $shape.OLEFormat.Object
  $sheet = $workbook.ActiveSheet
  $sheet.Range('A1').Value2 = 'Hello from Excel'
  $sheet.Range('B1').Value2 = 42

  # Measurement, printed for the task report: what PowerPoint itself thinks
  # this shape and its embedded object are, before the round trip.
  "OLEFormat.ProgID=$($shape.OLEFormat.ProgID)"
  "Shape.Type=$($shape.Type)"

  if (Test-Path $OutPath) { Remove-Item $OutPath -Force }
  $pres.SaveAs($OutPath, 1) # ppSaveAsPresentation (97-2003 .ppt)
  $pres.Close()
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}

"Wrote $OutPath"
