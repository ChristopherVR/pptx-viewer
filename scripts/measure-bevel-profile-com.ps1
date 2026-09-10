<#
.SYNOPSIS
  Scratch tooling (not committed): export the bevel-profile fixture's slides
  via PowerPoint COM at high resolution, then sample a 40-point brightness
  line from the top edge inward for each of the 24 (profile x depth) squares.

.DESCRIPTION
  Part of the docs/guide/limitations.md "3-D shapes and scenes" item 1 COM
  measurement campaign: fits the 12 `a:bevelT/@prst` height-map profiles to
  real PowerPoint cross-section brightness curves instead of leaving them
  reasoned from ECMA-376 alone.

.PARAMETER PptxPath
  Path to bevel-profile-com.pptx (from make-bevel-profile-fixture.mjs).
.PARAMETER JsonPath
  Path to the sidecar bevel-profile-com.json.
.PARAMETER OutJson
  Where to write the measured curves.

.EXAMPLE
  pwsh -File scripts/measure-bevel-profile-com.ps1 `
    .scratch-bevel/bevel-profile-com.pptx .scratch-bevel/bevel-profile-com.json `
    .scratch-bevel/bevel-profile-measured.json
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
$exportDir = Join-Path ([System.IO.Path]::GetDirectoryName($OutJson)) 'export'
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null

$exportWidthPx = 8000
$exportHeightPx = [Math]::Round($exportWidthPx * $meta.slideHeightIn / $meta.slideWidthIn)
$pxPerIn = $exportWidthPx / $meta.slideWidthIn

$app = $null
$pres = $null
$results = @()
try {
  $app = New-Object -ComObject PowerPoint.Application
  $app.DisplayAlerts = 1
  $pres = $app.Presentations.Open($pptxPath, $true, $false, $false)

  $slideFiles = @{}
  foreach ($slide in $pres.Slides) {
    $idx = $slide.SlideIndex
    $file = Join-Path $exportDir "slide$idx.png"
    $slide.Export($file, 'PNG', $exportWidthPx, $exportHeightPx)
    $slideFiles[$idx] = $file
  }

  foreach ($shape in $meta.shapes) {
    $file = $slideFiles[[int]$shape.slideIndex]
    $bmp = [System.Drawing.Bitmap]::FromFile($file)
    try {
      $centerXPx = [Math]::Round($shape.centerXIn * $pxPerIn)
      $topYPx = [Math]::Round($shape.topYIn * $pxPerIn)
      $samples = @()
      for ($i = 0; $i -lt 40; $i++) {
        $offsetIn = 0.01 + ($i / 39.0) * 0.49
        $y = [Math]::Round($topYPx + $offsetIn * $pxPerIn)
        if ($y -ge $bmp.Height) { $y = $bmp.Height - 1 }
        # 3x3 average for noise resistance.
        $sum = 0.0
        $n = 0
        for ($dx = -1; $dx -le 1; $dx++) {
          for ($dy = -1; $dy -le 1; $dy++) {
            $px = $centerXPx + $dx
            $py = $y + $dy
            if ($px -ge 0 -and $px -lt $bmp.Width -and $py -ge 0 -and $py -lt $bmp.Height) {
              $c = $bmp.GetPixel($px, $py)
              $lum = 0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B
              $sum += $lum
              $n += 1
            }
          }
        }
        $samples += [Math]::Round($sum / $n, 2)
        $offsetIn | Out-Null
      }
      $results += [PSCustomObject]@{
        profile = $shape.profile
        depthPt = $shape.depthPt
        offsetsIn = @(0..39 | ForEach-Object { [Math]::Round(0.01 + ($_ / 39.0) * 0.49, 4) })
        brightness = $samples
      }
      Write-Host "sampled $($shape.profile) $($shape.depthPt)pt"
    } finally {
      $bmp.Dispose()
    }
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
