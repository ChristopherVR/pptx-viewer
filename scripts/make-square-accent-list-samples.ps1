<#
.SYNOPSIS
  Add "Square Accent List" flat3/hier8 samples to the SmartArt gallery corpus
  via PowerPoint COM, alongside the existing hier5 fixture.

.DESCRIPTION
  `square-accent-list--hier5.pptx` (SmartArt Track R, SESSION 38/39) is the
  ONLY built-in-gallery fixture combining `hierAlign="tL"` with a gate-3
  (root-vs-descendant template split) failure, so `computeAxisPitch`'s
  generation-axis centred-shift model could not be triangulated from a single
  data point (see `smartart-track-r-successor.md`, SESSION 38's item 3 and
  SESSION 39's own follow-up). This script generates two more node-count
  variants of the SAME layout ("Square Accent List", by `SmartArtLayout.Name`,
  matching every other gallery fixture's own generation convention in
  `make-smartart-gallery.ps1`) so the shift constant can be solved from 3
  independent samples instead of guessed: `flat3` (3 flat nodes, depth 1,
  degenerate `n=1` generation-axis case) and `hier8` (8 nodes / 3 levels,
  deeper generation-axis fan than hier5's 2).

  Uses the exact same node text sets, demote pattern, resize-nudge-before-
  save, and SaveAs mechanism as `make-smartart-gallery.ps1` (so the cached
  `dsp:drawing` this produces is directly comparable), just scoped to one
  layout instead of the whole gallery.

.NOTES
  Requires a local PowerPoint install (COM automation, Windows only).
  Re-running is safe: it overwrites only the two files it writes; existing
  `manifest.json` entries for other fixtures are preserved (existing
  `square-accent-list--hier5.pptx` entry, and any prior run of this script's
  own two rows, are replaced in place, not duplicated).
#>
param(
  [string]$OutDir = "$PSScriptRoot\..\packages\core\src\__tests__\fixtures\smartart-gallery"
)

$ErrorActionPreference = 'Stop'

$LayoutName = 'Square Accent List'

function New-GalleryFixture {
  param($App, $Layout, [string[]]$Texts, [int[]]$DemoteIndexes, [string]$OutPath)

  $pres = $App.Presentations.Add()
  try {
    $slide = $pres.Slides.Add(1, 12) # ppLayoutBlank
    $shape = $slide.Shapes.AddSmartArt($Layout, 40, 90, 650, 400)
    $sa = $shape.SmartArt

    while ($sa.Nodes.Count -gt 0) { $sa.Nodes.Item(1).Delete() | Out-Null }
    foreach ($t in $Texts) {
      $n = $sa.Nodes.Add()
      $n.TextFrame2.TextRange.Text = $t
    }
    foreach ($idx in $DemoteIndexes) {
      try {
        $sa.AllNodes.Item($idx).Demote() | Out-Null
      } catch {
        Write-Output "  demote($idx) not supported by this layout: $($_.Exception.Message)"
      }
    }

    # Resize nudge: forces PowerPoint to recompute the cached dsp:drawing.
    $w = [single]$shape.Width
    $h = [single]$shape.Height
    $shape.Width = [single]($w + 5)
    $shape.Height = [single]($h + 5)
    $shape.Width = $w
    $shape.Height = $h

    $pres.SaveAs($OutPath, 24) # ppSaveAsOpenXMLPresentation
    return $true
  } finally {
    $pres.Close()
  }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$App = New-Object -ComObject PowerPoint.Application
$App.Visible = $true
$App.DisplayAlerts = 1
$warm = $App.Presentations.Add()
$warm.Slides.Add(1, 12) | Out-Null
Start-Sleep -Milliseconds 300

$layout = $null
for ($i = 1; $i -le $App.SmartArtLayouts.Count; $i++) {
  $l = $App.SmartArtLayouts.Item($i)
  if ([string]$l.Name -eq $LayoutName) { $layout = $App.SmartArtLayouts.Item($i); break }
}
if (-not $layout) {
  $warm.Close()
  $App.Quit()
  throw "Layout '$LayoutName' not found in this PowerPoint install's SmartArtLayouts."
}

$flat3 = @('Alpha', 'Beta has a noticeably longer label than the others', 'Gamma')
$hier8 = @(
  'Branch A Root', 'Branch A Child', 'Branch A Grandchild with long text',
  'Branch B Root', 'Branch B Child', 'Branch B Grandchild',
  'Branch C Root', 'Branch C Child'
)

$jobs = @(
  @{ Kind = 'flat3'; Texts = $flat3; Demote = @() },
  @{ Kind = 'hier8'; Texts = $hier8; Demote = @(2, 3, 5, 6, 8) }
)

$newRows = @()
$failures = @()
foreach ($job in $jobs) {
  $fileName = "square-accent-list--$($job.Kind).pptx"
  $outPath = Join-Path $OutDir $fileName
  Write-Output "$LayoutName / $($job.Kind) -> $fileName"
  try {
    New-GalleryFixture -App $App -Layout $layout -Texts $job.Texts -DemoteIndexes $job.Demote -OutPath $outPath | Out-Null
    $newRows += [pscustomobject]@{
      file       = $fileName
      layoutName = $LayoutName
      category   = 'list'
      dataset    = $job.Kind
    }
  } catch {
    Write-Output "  FAILED: $($_.Exception.Message)"
    $failures += "$($job.Kind): $($_.Exception.Message)"
  }
}

$manifestPath = Join-Path $OutDir 'manifest.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifestList = [System.Collections.Generic.List[object]]::new()
foreach ($row in $manifest) {
  $isReplaced = $false
  foreach ($nr in $newRows) { if ($row.file -eq $nr.file) { $isReplaced = $true } }
  if (-not $isReplaced) { $manifestList.Add($row) }
}
foreach ($nr in $newRows) { $manifestList.Add($nr) }
$sorted = $manifestList | Sort-Object file
$sorted | ConvertTo-Json -Depth 4 | Out-File -FilePath $manifestPath -Encoding utf8
Write-Output "Updated manifest: $($sorted.Count) entries ($($newRows.Count) added/replaced by this script)."

if ($failures.Count -gt 0) {
  Write-Output "`n$($failures.Count) FAILURES:"
  $failures | ForEach-Object { Write-Output "  $_" }
}

$warm.Close()
$App.Quit()
