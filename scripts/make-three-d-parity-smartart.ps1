<#
.SYNOPSIS
  Regenerate the 3D parity ground truth for SmartArt (8 layouts x every quick style) via PowerPoint COM.

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

$layouts = @('Basic Block List', 'Basic Process', 'Basic Cycle', 'Organization Chart', 'Basic Pyramid', 'Basic Venn', 'Basic Chevron Process', 'Basic Radial')
$texts = @('Alpha', 'Beta', 'Gamma', 'Delta')

$App = New-Object -ComObject PowerPoint.Application
$App.Visible = $true
$pres = $App.Presentations.Add()
$pres.Slides.Add(1, 12) | Out-Null
Start-Sleep -Milliseconds 500

$styleInfo = @()
for ($i = 1; $i -le $App.SmartArtQuickStyles.Count; $i++) {
  $styleInfo += [pscustomobject]@{ Index = $i; Name = [string]$App.SmartArtQuickStyles.Item($i).Name }
}
$layoutIdx = @{}
for ($i = 1; $i -le $App.SmartArtLayouts.Count; $i++) {
  $layoutIdx[[string]$App.SmartArtLayouts.Item($i).Name] = $i
}
Write-Output ("styles: " + (($styleInfo | ForEach-Object { "$($_.Index)=$($_.Name)" }) -join ', '))

$pres.Slides.Item(1).Delete()
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540
$n = 1
$manifest = @()
foreach ($ln in $layouts) {
  if (-not $layoutIdx.ContainsKey($ln)) { Write-Output "missing layout $ln"; continue }
  foreach ($st in $styleInfo) {
    $slide = $pres.Slides.Add($n, 12)
    $layout = $App.SmartArtLayouts.Item($layoutIdx[$ln])
    $shape = $slide.Shapes.AddSmartArt($layout, 80, 60, 800, 420)
    $sa = $shape.SmartArt
    while ($sa.AllNodes.Count -gt 0) { $sa.AllNodes.Item(1).Delete() | Out-Null }
    foreach ($t in $texts) { $nd = $sa.AllNodes.Add(); $nd.TextFrame2.TextRange.Text = $t }
    if ($ln -eq 'Organization Chart') { try { $sa.AllNodes.Item(2).Demote() | Out-Null; $sa.AllNodes.Item(3).Demote() | Out-Null; $sa.AllNodes.Item(4).Demote() | Out-Null } catch {} }
    if ($ln -eq 'Basic Radial') { try { $sa.AllNodes.Item(2).Demote() | Out-Null; $sa.AllNodes.Item(3).Demote() | Out-Null; $sa.AllNodes.Item(4).Demote() | Out-Null } catch {} }
    $sa.QuickStyle = $App.SmartArtQuickStyles.Item($st.Index)
    $w = [single]$shape.Width; $h = [single]$shape.Height
    $shape.Width = [single]($w + 5); $shape.Height = [single]($h + 5); $shape.Width = $w; $shape.Height = $h
    $manifest += "$n`t$ln`t$($st.Name)"
    $n++
  }
}
$path = Join-Path $OutDir 'three-d-smartart.pptx'
$pres.SaveAs($path, 24)
for ($k = 1; $k -le $pres.Slides.Count; $k++) {
  $pres.Slides.Item($k).Export((Join-Path $OutDir ("sa-{0:D3}.png" -f $k)), 'PNG', 1280, 720)
}
$manifest | Set-Content (Join-Path $OutDir 'three-d-smartart.tsv')
$pres.Close()
Write-Output "saved $path ($($n-1) slides)"
