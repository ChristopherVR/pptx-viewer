<#
.SYNOPSIS
  Scratch tooling (not committed): COM ground truth for the item-2 (metal/
  circle specular-masking) re-score. Exports the bevel-material fixture slide
  and samples top/bottom edge brightness (0.15in in) for each of the 8
  (profile x material) shapes.

.EXAMPLE
  pwsh -File scripts/measure-bevel-material-com.ps1 `
    .scratch-bevel/bevel-material-com.pptx .scratch-bevel/bevel-material-com.json `
    .scratch-bevel/bevel-material-measured.json
#>
param(
  [Parameter(Mandatory = $true)][string]$PptxPath,
  [Parameter(Mandatory = $true)][string]$JsonPath,
  [Parameter(Mandatory = $true)][string]$OutJson
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$meta = Get-Content -LiteralPath $JsonPath -Raw | ConvertFrom-Json
$pptxPath = (Resolve-Path -LiteralPath $PptxPath).Path
$exportDir = Join-Path ([System.IO.Path]::GetDirectoryName($OutJson)) 'export-material'
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null

$exportWidthPx = 8000
$exportHeightPx = [Math]::Round($exportWidthPx * $meta.slideHeightIn / $meta.slideWidthIn)
$pxPerIn = $exportWidthPx / $meta.slideWidthIn
$sampleOffsetIn = 0.15

function Sample-Point($bmp, $xPx, $yPx) {
  $sum = 0.0
  $n = 0
  for ($dx = -2; $dx -le 2; $dx++) {
    for ($dy = -2; $dy -le 2; $dy++) {
      $px = $xPx + $dx
      $py = $yPx + $dy
      if ($px -ge 0 -and $px -lt $bmp.Width -and $py -ge 0 -and $py -lt $bmp.Height) {
        $c = $bmp.GetPixel($px, $py)
        $sum += 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B
        $n += 1
      }
    }
  }
  return [Math]::Round($sum / $n, 2)
}

$app = $null
$pres = $null
$results = @()
try {
  $app = New-Object -ComObject PowerPoint.Application
  $app.DisplayAlerts = 1
  $pres = $app.Presentations.Open($pptxPath, $true, $false, $false)
  $slide = $pres.Slides.Item(1)
  $file = Join-Path $exportDir 'slide1.png'
  $slide.Export($file, 'PNG', $exportWidthPx, $exportHeightPx)

  $bmp = [System.Drawing.Bitmap]::FromFile($file)
  try {
    foreach ($shape in $meta.shapes) {
      $cx = [Math]::Round($shape.centerXIn * $pxPerIn)
      $cy = [Math]::Round($shape.centerYIn * $pxPerIn)
      $topY = [Math]::Round(($shape.topYIn + $sampleOffsetIn) * $pxPerIn)
      $bottomY = [Math]::Round(($shape.bottomYIn - $sampleOffsetIn) * $pxPerIn)
      $leftX = [Math]::Round(($shape.leftXIn + $sampleOffsetIn) * $pxPerIn)
      $rightX = [Math]::Round(($shape.rightXIn - $sampleOffsetIn) * $pxPerIn)

      $top = Sample-Point $bmp $cx $topY
      $bottom = Sample-Point $bmp $cx $bottomY
      $left = Sample-Point $bmp $leftX $cy
      $right = Sample-Point $bmp $rightX $cy
      $center = Sample-Point $bmp $cx $cy

      $results += [PSCustomObject]@{
        profile = $shape.profile
        material = $shape.material
        dir = $shape.dir
        top = $top
        bottom = $bottom
        left = $left
        right = $right
        center = $center
      }
      Write-Host "sampled $($shape.profile) $($shape.material): top=$top bottom=$bottom left=$left right=$right center=$center"
    }
  } finally {
    $bmp.Dispose()
  }
} finally {
  if ($null -ne $pres) { try { $pres.Close() } catch { } }
  if ($null -ne $app) {
    try { $app.Quit() } catch { }
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}

$results | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutJson -Encoding UTF8
Write-Host "wrote $OutJson"
