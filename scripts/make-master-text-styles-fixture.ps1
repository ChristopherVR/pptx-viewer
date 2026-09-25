<#
.SYNOPSIS
  Author `packages/core/src/__tests__/fixtures/master-text-styles.pptx`
  through real PowerPoint over COM: a deck whose own slide master overrides
  the title style (54pt bold Georgia, red, centred) and the body style
  (level 1: 26pt italic Verdana, blue; level 2: 21pt Verdana), with one
  Title and Content slide carrying a title and a two-level bulleted body.

.DESCRIPTION
  Also writes PowerPoint's own 97-2003 SaveAs of the same deck next to it
  (`master-text-styles.powerpoint.ppt`, not checked in) as the ground truth
  the `.ppt` writer's placeholder text and master text styles were measured
  against: reopened in PowerPoint, its title run reads 54pt Georgia bold,
  its body runs 26pt Verdana italic and 21pt Verdana at indent level 2, and
  a slide added in PowerPoint inherits the same styles.

.PARAMETER OutDir
  Where to write both files (defaults to the core fixtures directory).

.NOTES
  Windows + PowerPoint only. Never quits a running PowerPoint.
#>
param(
  [string]$OutDir = (Join-Path $PSScriptRoot '..\packages\core\src\__tests__\fixtures')
)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add($false)
$m = $pres.SlideMaster
$t = $m.TextStyles.Item(2).Levels.Item(1) # ppTitleStyle
$t.Font.Size = 54; $t.Font.Bold = -1; $t.Font.Name = 'Georgia'; $t.Font.Color.RGB = 0x0000C0
$t.ParagraphFormat.Alignment = 2 # ppAlignCenter
$b1 = $m.TextStyles.Item(3).Levels.Item(1) # ppBodyStyle
$b1.Font.Size = 26; $b1.Font.Italic = -1; $b1.Font.Name = 'Verdana'; $b1.Font.Color.RGB = 0xC00000
$b2 = $m.TextStyles.Item(3).Levels.Item(2)
$b2.Font.Size = 21; $b2.Font.Name = 'Verdana'
$s = $pres.Slides.Add(1, 2) # ppLayoutText
$s.Shapes.Item(1).TextFrame.TextRange.Text = 'Master title'
$s.Shapes.Item(2).TextFrame.TextRange.Text = "Body one`rBody two"
$s.Shapes.Item(2).TextFrame.TextRange.Paragraphs(2).IndentLevel = 2
$dir = Resolve-Path $OutDir
$pres.SaveAs((Join-Path $dir 'master-text-styles.pptx'), 24)
$pres.SaveAs((Join-Path $dir 'master-text-styles.powerpoint.ppt'), 1)
$pres.Close()
"wrote $dir\master-text-styles.pptx"
