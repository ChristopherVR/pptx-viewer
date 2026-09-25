<#
.SYNOPSIS
  Generate packages/core/src/__tests__/fixtures/corpus/smartart-orgchart-assistants.pptx
  via PowerPoint COM: three "Organization Chart" diagrams whose manager has
  1, 3 and 4 assistants above its three reports.

.DESCRIPTION
  Starts from the layout's default data (a manager, one assistant, three
  reports) and adds assistants with `SmartArtNode.AddNode(msoSmartArtNodeAfter)`
  on the existing assistant, which keeps the new node an assistant. A resize
  nudge forces PowerPoint to recompute the cached drawing before saving.
#>
param(
  [string]$OutPath = "$PSScriptRoot\..\packages\core\src\__tests__\fixtures\corpus\smartart-orgchart-assistants.pptx"
)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$app.Visible = $true
$pres = $app.Presentations.Add()
$layoutIndex = 0
for ($i = 1; $i -le $app.SmartArtLayouts.Count; $i++) {
  if ([string]$app.SmartArtLayouts.Item($i).Name -eq 'Organization Chart') { $layoutIndex = $i; break }
}

$slideIndex = 0
foreach ($assistants in @(1, 3, 4)) {
  $slideIndex++
  $slide = $pres.Slides.Add($slideIndex, 12)
  $shape = $slide.Shapes.AddSmartArt($app.SmartArtLayouts.Item($layoutIndex), 40, 90, 650, 400)
  $all = $shape.SmartArt.AllNodes
  $asst = $null
  $report = 0
  for ($i = 1; $i -le $all.Count; $i++) {
    $n = $all.Item($i)
    if ($n.Level -eq 1) { $n.TextFrame2.TextRange.Text = 'Manager' }
    elseif ($n.Type -eq 2) { $asst = $n; $n.TextFrame2.TextRange.Text = 'Asst 1' }
    else { $report++; $n.TextFrame2.TextRange.Text = "Report $report" }
  }
  for ($i = 2; $i -le $assistants; $i++) {
    $asst.AddNode(2).TextFrame2.TextRange.Text = "Asst $i"
  }
  $w = [single]$shape.Width; $h = [single]$shape.Height
  $shape.Width = [single]($w + 5); $shape.Height = [single]($h + 5)
  $shape.Width = $w; $shape.Height = $h
}
$pres.SaveAs((Resolve-Path -LiteralPath (Split-Path $OutPath)).Path + '\' + (Split-Path $OutPath -Leaf))
$pres.Close()
