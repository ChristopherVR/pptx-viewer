<#
.SYNOPSIS
  Regenerate the 3D parity ground truth for charts via PowerPoint COM.

.DESCRIPTION
  Builds e2e/fixtures/three-d-parity/three-d-*.pptx plus a manifest (.tsv)
  and one COM-exported PNG per slide. The committed ground truth is those
  PNGs downscaled to 960x540 WebP (gt/*.webp); the harness
  (`bun run demo:three-parity`) shows them next to the <pptx-three-view>
  render. Convert with any image tool after running, e.g. PIL:
  Image.open(png).resize((960, 540)).save(webp, 'WEBP', quality=88).
  Requires a local PowerPoint (and Excel, for charts) install.
#>
param([string]$OutDir = "$PSScriptRoot\..\e2e\fixtures\three-d-parity")
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# name, xlChartType, barShape (-1 = leave)
$charts = @(
  @('3d-column-clustered', 54, -1),
  @('3d-column-stacked', 55, -1),
  @('3d-column-stacked100', 56, -1),
  @('3d-column-standard', -4100, -1),
  @('3d-bar-clustered', 60, -1),
  @('3d-bar-stacked', 61, -1),
  @('3d-column-cylinder', 54, 3),
  @('3d-column-cone', 54, 4),
  @('3d-column-pyramid', 54, 1),
  @('3d-line', -4101, -1),
  @('3d-area', -4098, -1),
  @('3d-area-stacked', 78, -1),
  @('3d-area-stacked100', 79, -1),
  @('3d-pie', -4102, -1),
  @('3d-pie-exploded', 70, -1),
  @('3d-surface', 83, -1),
  @('3d-surface-wireframe', 84, -1)
)

$App = New-Object -ComObject PowerPoint.Application
$App.Visible = $true
$pres = $App.Presentations.Add()
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540
$i = 1
$manifest = @()
foreach ($c in $charts) {
  $slide = $pres.Slides.Add($i, 12)
  try {
    $shape = $slide.Shapes.AddChart2(-1, $c[1], 60, 40, 840, 460, $true)
    $chart = $shape.Chart
    $chart.ChartData.Activate()
    $wb = $null
    for ($a = 0; $a -lt 20 -and $null -eq $wb; $a++) { Start-Sleep -Milliseconds 400; try { $wb = $chart.ChartData.Workbook } catch { $wb = $null } }
    if ($null -ne $wb) { $wb.Close() }
    Start-Sleep -Milliseconds 300
    if ($c[2] -ge 0) {
      for ($s = 1; $s -le $chart.SeriesCollection().Count; $s++) {
        try { $chart.SeriesCollection($s).BarShape = $c[2] } catch { Write-Output "  barShape fail: $($_.Exception.Message)" }
      }
    }
    $manifest += "$i`t$($c[0])"
    Write-Output "[$i] $($c[0]) ok"
  } catch {
    Write-Output "[$i] $($c[0]) FAILED: $($_.Exception.Message)"
    $manifest += "$i`t$($c[0])`tFAILED"
  }
  $i++
}
$path = Join-Path $OutDir 'three-d-charts.pptx'
$pres.SaveAs($path, 24)
for ($n = 1; $n -le $pres.Slides.Count; $n++) {
  $pres.Slides.Item($n).Export((Join-Path $OutDir ("chart-{0:D2}.png" -f $n)), 'PNG', 1920, 1080)
}
$manifest | Set-Content (Join-Path $OutDir 'three-d-charts.tsv')
$pres.Close()
Write-Output "saved $path"
