<#
.SYNOPSIS
  Generate the SmartArt gallery ground-truth corpus via PowerPoint COM.

.DESCRIPTION
  Enumerates every built-in SmartArt layout PowerPoint reports through
  `Application.SmartArtLayouts` (176 on this install: the classic 2016-era
  List/Process/Cycle/Hierarchy/Relationship/Matrix/Pyramid/Picture galleries,
  plus the newer Timeline/Meet-the-Team/Text-Card families some 365 builds
  ship), adds one SmartArt graphic per layout with a deterministic node/text
  data set, and saves each as its own one-slide .pptx. PowerPoint bakes the
  `data`, `layout`, `colors`, `quickStyle` AND cached `drawing` diagram parts
  into every file it writes, which is exactly the ground truth
  `smartart-gallery-ground-truth.test.ts` compares the DiagramML interpreter
  against.

  Every layout gets a "hier5" data set (5 nodes, 2 levels of hierarchy where
  the layout supports it, mixed-length text): this is the full-gallery
  coverage pass. A curated subset of layouts spanning every algorithm family
  (list/process/cycle/hierarchy/relationship/matrix/pyramid/picture/timeline/
  meet-the-team/text-card) additionally gets "flat3" (3 flat nodes) and
  "hier8" (8 nodes, 3 levels) data sets, for deeper stress on hierarchy/
  constraint code paths without tripling the size of the whole corpus (each
  fixture is ~35-50 KB; 176 + 2*30 = 236 files is already a multi-megabyte
  corpus).

  Hierarchy is built with `SmartArtNode.Demote()` (the same operation the
  text-pane Tab key performs), not `AddNode()`'s NodeLevel enum, so it works
  uniformly across every layout family without per-layout special-casing.
  Layouts that reject demotion (pure linear/list layouts) simply keep the
  nodes at their added (flat) level; the script logs and continues rather
  than failing the run.

  A resize nudge (grow then shrink back, matching the technique already used
  for `smartart-orgchart-*.pptx` in fixtures/corpus) forces PowerPoint to
  recompute the cached drawing before SaveAs; without it the saved drawing
  part can silently keep pre-edit geometry.

.PARAMETER OutDir
  Destination directory for the generated .pptx files. Defaults to
  packages/core/src/__tests__/fixtures/smartart-gallery relative to the repo
  root.

.PARAMETER Only
  Optional comma-separated list of layout names to restrict generation to
  (for quick re-runs after fixing one layout's data set). Matches
  `SmartArtLayout.Name` exactly, e.g. -Only "Basic Process,Basic Venn".

.NOTES
  Requires a local PowerPoint install (COM automation, Windows only). Re-run
  this script to regenerate the corpus; it is deterministic given the same
  PowerPoint version and gallery.
#>
param(
  [string]$OutDir = "$PSScriptRoot\..\packages\core\src\__tests__\fixtures\smartart-gallery",
  # Comma-separated list of exact SmartArtLayout.Name values to restrict
  # generation to (quick re-runs after fixing one layout's data set).
  [string]$Only = ''
)
$OnlyList = @()
if ($Only -ne '') { $OnlyList = $Only -split ',' | ForEach-Object { $_.Trim() } }

$ErrorActionPreference = 'Stop'

# Layouts that additionally get "flat3" and "hier8" data sets, chosen to span
# every dgm:alg family (linear/snake, cycle, pyramid, hierChild/hierRoot,
# composite, connector) and every gallery category PowerPoint reports.
$DeepLayouts = @(
  'Basic Block List', 'Vertical Bullet List', 'Picture Accent List',
  'Basic Process', 'Basic Chevron Process', 'Continuous Block Process', 'Basic Timeline',
  'Basic Cycle', 'Radial Cycle', 'Continuous Cycle', 'Text Cycle',
  'Organization Chart', 'Hierarchy', 'Horizontal Hierarchy', 'Table Hierarchy',
  'Basic Venn', 'Funnel', 'Gear', 'Opposing Arrows', 'Basic Target', 'Equation',
  'Basic Matrix', 'Grid Matrix',
  'Basic Pyramid', 'Segmented Pyramid', 'Pyramid List',
  'Bending Picture Accent List', 'Picture Grid',
  'Small Dots Horizontal', 'Meet The Team', 'Text Card Short Line'
)

function ConvertTo-Slug {
  param([string]$Name)
  $slug = $Name.ToLowerInvariant()
  $slug = $slug -replace "[^a-z0-9]+", '-'
  $slug = $slug.Trim('-')
  return $slug
}

function Set-DemoteSet {
  param($smartArt, [int[]]$Indexes)
  foreach ($idx in $Indexes) {
    try {
      $smartArt.AllNodes.Item($idx).Demote() | Out-Null
    } catch {
      Write-Output "  demote($idx) not supported by this layout: $($_.Exception.Message)"
    }
  }
}

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
    Set-DemoteSet -smartArt $sa -Indexes $DemoteIndexes

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

# NOTE: SmartArtLayout COM objects returned by .Item(i) go stale (Name/
# Category read back empty) if stored in a PowerShell array and read back
# later; only plain data (index/name/category) survives. The live object is
# re-fetched by index from $App.SmartArtLayouts immediately before use below.
$layoutInfo = @()
for ($i = 1; $i -le $App.SmartArtLayouts.Count; $i++) {
  $l = $App.SmartArtLayouts.Item($i)
  $layoutInfo += [pscustomobject]@{ Index = $i; Name = [string]$l.Name; Category = [string]$l.Category }
}
Write-Output "Discovered $($layoutInfo.Count) built-in SmartArt layouts."

$flat3 = @('Alpha', 'Beta has a noticeably longer label than the others', 'Gamma')
$hier5 = @('Node One', 'Node Two has a longer label', 'Node Three', 'Node Four', 'Node Five')
$hier8 = @(
  'Branch A Root', 'Branch A Child', 'Branch A Grandchild with long text',
  'Branch B Root', 'Branch B Child', 'Branch B Grandchild',
  'Branch C Root', 'Branch C Child'
)

$manifest = @()
$failures = @()
$count = 0

foreach ($info in $layoutInfo) {
  if ($OnlyList.Count -gt 0 -and -not ($OnlyList -contains $info.Name)) { continue }
  $layout = $App.SmartArtLayouts.Item($info.Index)
  $slug = ConvertTo-Slug $info.Name
  $isDeep = $DeepLayouts -contains $info.Name

  $jobs = @(
    @{ Kind = 'hier5'; Texts = $hier5; Demote = @(2, 5) }
  )
  if ($isDeep) {
    $jobs += @{ Kind = 'flat3'; Texts = $flat3; Demote = @() }
    $jobs += @{ Kind = 'hier8'; Texts = $hier8; Demote = @(2, 3, 5, 6, 8) }
  }

  $anySucceeded = $false
  foreach ($job in $jobs) {
    $fileName = "$slug--$($job.Kind).pptx"
    $outPath = Join-Path $OutDir $fileName
    Write-Output "[$($count+1)] $($info.Name) / $($job.Kind) -> $fileName"
    try {
      New-GalleryFixture -App $App -Layout $layout -Texts $job.Texts -DemoteIndexes $job.Demote -OutPath $outPath | Out-Null
      $manifest += [pscustomobject]@{
        file       = $fileName
        layoutName = $info.Name
        category   = $info.Category
        dataset    = $job.Kind
      }
      $anySucceeded = $true
    } catch {
      Write-Output "  FAILED: $($_.Exception.Message)"
      $failures += "$($info.Name)/$($job.Kind): $($_.Exception.Message)"
    }
    $count++
  }

  # Gallery-completeness fallback: some layouts have a fixed or narrow shape
  # count (matrices, opposing-pair relationships, Venn/target caps) that
  # rejects every fixed-size data set above. Rather than leave the layout
  # with zero ground truth, retry with flat data sets shrinking from 4 down
  # to 1 node until PowerPoint accepts one, and use it as-is (no hierarchy).
  if (-not $anySucceeded) {
    foreach ($n in 4, 3, 2, 1) {
      $texts = ($flat3 + $hier5 + $hier8) | Select-Object -First $n
      $fileName = "$slug--fallback-n$n.pptx"
      $outPath = Join-Path $OutDir $fileName
      Write-Output "[$($count+1)] $($info.Name) / fallback-n$n -> $fileName"
      try {
        New-GalleryFixture -App $App -Layout $layout -Texts $texts -DemoteIndexes @() -OutPath $outPath | Out-Null
        $manifest += [pscustomobject]@{
          file       = $fileName
          layoutName = $info.Name
          category   = $info.Category
          dataset    = "fallback-n$n"
        }
        $anySucceeded = $true
        $count++
        break
      } catch {
        Write-Output "  FAILED: $($_.Exception.Message)"
        $count++
      }
    }
    if (-not $anySucceeded) {
      $failures += "$($info.Name): NO fixture could be generated at any node count"
    }
  }
}

$manifestPath = Join-Path $OutDir 'manifest.json'
$manifest | ConvertTo-Json -Depth 4 | Out-File -FilePath $manifestPath -Encoding utf8
Write-Output "Wrote manifest with $($manifest.Count) entries to $manifestPath"

if ($failures.Count -gt 0) {
  Write-Output "`n$($failures.Count) FAILURES:"
  $failures | ForEach-Object { Write-Output "  $_" }
} else {
  Write-Output "`nAll $($manifest.Count) fixtures generated successfully."
}

$warm.Close()
$App.Quit()
