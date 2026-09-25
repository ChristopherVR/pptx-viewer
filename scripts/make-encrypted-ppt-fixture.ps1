<#
.SYNOPSIS
  Author `packages/core/src/__tests__/fixtures/encrypted-powerpoint.ppt`
  through real PowerPoint over COM: a two-slide deck with a title, a
  two-paragraph body, a filled rectangle and a small PNG, saved as PowerPoint 97-2003
  (`SaveAs` format 1) with `Presentation.Password = 'pptx-viewer'`.

.DESCRIPTION
  PowerPoint encrypts a 97-2003 save with RC4 CryptoAPI ([MS-OFFCRYPTO]
  2.3.5): the key is SHA-1(salt + password) re-keyed per block with no spin
  rounds. This file is the ground truth the importer's legacy key derivation
  is tested against.

.PARAMETER OutDir
  Where to write the file (defaults to the core fixtures directory).

.NOTES
  Windows + PowerPoint only. Never quits a running PowerPoint.
#>
param(
  [string]$OutDir = (Join-Path $PSScriptRoot '..\packages\core\src\__tests__\fixtures')
)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add($false)
$s1 = $pres.Slides.Add(1, 2) # ppLayoutText
$s1.Shapes.Item(1).TextFrame.TextRange.Text = 'Encrypted by PowerPoint'
$s1.Shapes.Item(2).TextFrame.TextRange.Text = "First point`rSecond point"
$s2 = $pres.Slides.Add(2, 12) # ppLayoutBlank
$r = $s2.Shapes.AddShape(1, 100, 100, 300, 150) # msoShapeRectangle
$r.Fill.ForeColor.RGB = 0x3070C0
$r.TextFrame.TextRange.Text = 'Second slide shape'
# A small generated PNG, so the file also has an encrypted "Pictures" stream.
Add-Type -AssemblyName System.Drawing
$png = Join-Path $env:TEMP 'pptx-viewer-encrypted-fixture.png'
$bmp = New-Object System.Drawing.Bitmap 32, 16
for ($x = 0; $x -lt 32; $x++) { for ($y = 0; $y -lt 16; $y++) {
  $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $x * 8, $y * 16, 128))
} }
$bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
$null = $s2.Shapes.AddPicture($png, 0, -1, 450, 300, 160, 80)
Remove-Item $png
$pres.Password = 'pptx-viewer'
$dir = Resolve-Path $OutDir
$pres.SaveAs((Join-Path $dir 'encrypted-powerpoint.ppt'), 1)
$pres.Close()
"wrote $dir\encrypted-powerpoint.ppt"
