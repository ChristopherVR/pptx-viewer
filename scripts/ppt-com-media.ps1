<#
.SYNOPSIS
  Open a legacy binary `.ppt` file through real PowerPoint via COM, report
  the audio shape's `Type`/`MediaType`, then round-trip it to `.pptx` and
  report the byte length of the media part PowerPoint itself re-exported.

.DESCRIPTION
  The embedded-audio counterpart to `scripts/ppt-com-ole.ps1`. Two things
  cannot be proven by reading `Shape.MediaFormat` alone: PowerPoint's OWN
  97-2003 exporter leaves `MediaFormat.Length` at 0 even for audio it wrote
  itself (a from-scratch `.ppt` built purely through COM `AddMediaObject2`
  and read back with a freshly-launched `PowerPoint.Application`; see
  `packages/core/src/core/ppt/writer/media-writer.ts`'s doc comment), so
  `MediaFormat.Length` is not a reliable pass/fail signal either way. The
  reliable proof is round-tripping through PowerPoint's own SaveAs to
  `.pptx` (format 24): if the SoundDataBlob this writer embedded was really
  read by PowerPoint's importer, the re-exported `.pptx` carries a real
  `ppt/media/*` part PowerPoint reconstructed from it.

  Output, one line per shape:

      SHAPE <index> type=<MsoShapeType> mediatype=<MsoMediaType or empty>

  then:

      RESAVED <path to the .pptx PowerPoint just wrote>

.PARAMETER Path
  A single `.ppt` path.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Called by
  `scripts/com-acceptance-ppt.mjs`'s media case, which unzips the `RESAVED`
  path itself and compares `ppt/media/*` against the original WAV bytes.
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
  $mediaType = ''
  try { $mediaType = $sh.MediaType } catch { $mediaType = '' }
  "SHAPE $i type=$($sh.Type) mediatype=$mediaType"
}

$resavePath = [System.IO.Path]::ChangeExtension($resolved, '.resaved.pptx')
if (Test-Path $resavePath) { Remove-Item $resavePath -Force }
$pres.SaveAs($resavePath, 24) # ppSaveAsOpenXMLPresentation
"RESAVED $resavePath"

$pres.Close()
$app.Quit()
