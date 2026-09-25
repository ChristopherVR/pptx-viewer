<#
.SYNOPSIS
  Re-saves the WordArt `can` measurement deck through PowerPoint COM with
  "Embed fonts in the file" on, so every face it uses travels inside the deck.
  The viewer then parses the real font FILE for every glyph (the font-file
  outline path), while the un-embedded original drives the traced-outline path
  for the very same fonts (all three are installed locally, so the viewer
  fetches no webfont for them). See `measure-wordart-can-viewer.mjs`.

.EXAMPLE
  pwsh -File scripts/embed-wordart-can-fonts-com.ps1 .scratch-wordart/wordart-can.pptx .scratch-wordart/wordart-can-embedded.pptx
#>
param(
  [Parameter(Mandatory = $true)][string]$PptxPath,
  [Parameter(Mandatory = $true)][string]$OutPath
)

$ErrorActionPreference = 'Stop'
$pptxPath = (Resolve-Path -LiteralPath $PptxPath).Path
$outPath = [System.IO.Path]::GetFullPath($OutPath)

$app = $null
$pres = $null
try {
  $app = New-Object -ComObject PowerPoint.Application
  $pres = $app.Presentations.Open($pptxPath, $true, $false, $false)
  # ppSaveAsOpenXMLPresentation = 24, EmbedTrueTypeFonts = msoTrue (-1).
  $pres.SaveAs($outPath, 24, -1)
  Write-Output "saved $outPath with embedded fonts"
}
finally {
  if ($pres) { $pres.Close() }
  if ($app) { $app.Quit() }
  [System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) | Out-Null
}
