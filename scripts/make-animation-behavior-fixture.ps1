<#
.SYNOPSIS
  Regenerate e2e/fixtures/animation-behavior-playback.pptx: a real
  PowerPoint-authored deck whose effects carry PowerPoint's own behaviour
  trees, for the behaviour-player e2e (e2e/animation-behavior-playback.spec.ts).

.DESCRIPTION
  One 960 x 540 pt slide per effect, each with a single red rectangle and an
  on-click effect of 1 s:

    1. Fly In from the left on a 100 x 100 pt square at x = 700 pt. PowerPoint
       starts it with its right edge on the slide's left edge (`ppt_x` from
       `0-#ppt_w/2`), so it travels x + w = 800 pt: eight of its own widths.
       The old preset keyframe travelled one width.
    2. Wipe From Bottom (subtype 4, `wipe(down)`) on a 200 x 200 pt square.
       PowerPoint reveals it from the bottom edge up.

  Ground truth for both: Presentation.CreateVideo at 62.5 fps (see
  docs/guide/limitations.md, Animation authoring).

.NOTES
  Requires a local PowerPoint install (COM). Windows only.

.EXAMPLE
  powershell -File scripts/make-animation-behavior-fixture.ps1
#>
param([string]$Out = (Join-Path $PSScriptRoot '..\e2e\fixtures\animation-behavior-playback.pptx'))
$ErrorActionPreference = 'Stop'
$Out = [System.IO.Path]::GetFullPath($Out)
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add(0)
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540

function Add-EffectSlide($index, $left, $top, $size, $effect, $direction) {
    $slide = $pres.Slides.Add($index, 12)
    $shape = $slide.Shapes.AddShape(1, $left, $top, $size, $size)
    $shape.Fill.ForeColor.RGB = 255
    $shape.Line.Visible = 0
    $fx = $slide.TimeLine.MainSequence.AddEffect($shape, $effect, 0, 1)
    $fx.EffectParameters.Direction = $direction
    $fx.Timing.Duration = 1
}

# msoAnimEffectFly = 2, msoAnimDirectionLeft = 4 (saves presetSubtype 8).
Add-EffectSlide 1 700 200 100 2 4
# msoAnimEffectWipe = 22, msoAnimDirectionDown = 3 (saves presetSubtype 4).
Add-EffectSlide 2 380 170 200 22 3

if (Test-Path $Out) { Remove-Item $Out -Force }
$pres.SaveAs($Out, 24)
$pres.Close()
Write-Output "wrote $Out"
