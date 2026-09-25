<#
.SYNOPSIS
  PowerPoint COM ground truth for the WordArt `can` interior-outline
  measurement (docs/guide/visual-effects.md, "WordArt envelope glyph-outline
  warping"). Exports every slide of the deck written by
  `make-wordart-can-fixture.ts` as a PNG at a fixed pixel size, for
  `measure-wordart-can-viewer.mjs` to score the viewer against.

.EXAMPLE
  bun run scripts/make-wordart-can-fixture.ts .scratch-wordart
  pwsh -File scripts/measure-wordart-can-com.ps1 .scratch-wordart/wordart-can.pptx .scratch-wordart/com
#>
param(
  [Parameter(Mandatory = $true)][string]$PptxPath,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$WidthPx = 1920,
  [int]$HeightPx = 1080
)

$ErrorActionPreference = 'Stop'
$pptxPath = (Resolve-Path -LiteralPath $PptxPath).Path
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$outDir = (Resolve-Path -LiteralPath $OutDir).Path

$app = $null
$pres = $null
try {
  $app = New-Object -ComObject PowerPoint.Application
  $pres = $app.Presentations.Open($pptxPath, $true, $false, $false)
  $count = $pres.Slides.Count
  for ($i = 1; $i -le $count; $i++) {
    $file = Join-Path $outDir ("slide{0}.png" -f $i)
    $pres.Slides.Item($i).Export($file, 'PNG', $WidthPx, $HeightPx)
  }
  Write-Output "exported $count slides at ${WidthPx}x${HeightPx} to $outDir"
}
finally {
  if ($pres) { $pres.Close() }
  if ($app) { $app.Quit() }
  [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) | Out-Null
}
