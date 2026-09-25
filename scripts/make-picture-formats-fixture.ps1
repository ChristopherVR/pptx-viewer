<#
.SYNOPSIS
  Author `packages/core/src/__tests__/fixtures/picture-formats.pptx` through
  real PowerPoint over COM: one slide holding a BMP, GIF, TIFF, EMF, WMF and
  SVG picture, each inserted with `Shapes.AddPicture`, plus PowerPoint's own
  97-2003 SaveAs of the same deck (`picture-formats.powerpoint.ppt`) as the
  ground truth the `.ppt` writer's picture handling is measured against.

.DESCRIPTION
  Every source image is generated in-script (System.Drawing for the rasters
  and the EMF, a hand-built placeable WMF, an inline SVG), so the fixture
  needs no checked-in inputs. PowerPoint converts the BMP to PNG on insert
  and keeps the SVG as a bare `asvg:svgBlip` with no raster fallback.

.PARAMETER OutDir
  Where to write both files (defaults to the core fixtures directory).

.NOTES
  Windows + PowerPoint only. Never quits a running PowerPoint.
#>
param(
  [string]$OutDir = (Join-Path $PSScriptRoot '..\packages\core\src\__tests__\fixtures')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$work = Join-Path ([System.IO.Path]::GetTempPath()) "picture-formats-$(Get-Random)"
New-Item -ItemType Directory -Force $work | Out-Null

$bmp = New-Object System.Drawing.Bitmap 64, 48
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(255, 30, 144, 255))
$g.FillEllipse([System.Drawing.Brushes]::OrangeRed, 8, 8, 40, 30)
$g.Dispose()
$bmp.Save("$work\img.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp.Save("$work\img.gif", [System.Drawing.Imaging.ImageFormat]::Gif)
$bmp.Save("$work\img.tif", [System.Drawing.Imaging.ImageFormat]::Tiff)

$ref = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $ref.GetHdc()
$frame = New-Object System.Drawing.RectangleF 0, 0, 200, 100
$emf = New-Object System.Drawing.Imaging.Metafile("$work\img.emf", $hdc, $frame, [System.Drawing.Imaging.MetafileFrameUnit]::Pixel, [System.Drawing.Imaging.EmfType]::EmfOnly)
$ref.ReleaseHdc($hdc)
$ref.Dispose()
$mg = [System.Drawing.Graphics]::FromImage($emf)
$mg.FillRectangle([System.Drawing.Brushes]::SeaGreen, 0, 0, 200, 100)
$mg.FillEllipse([System.Drawing.Brushes]::Gold, 20, 10, 160, 80)
$mg.Dispose()
$emf.Dispose()
$bmp.Dispose()

# Placeable WMF (96 units/inch, 200x100): red rectangle, blue ellipse.
$words = [System.Collections.Generic.List[int]]::new()
function Add-Rec([int]$fn, [int[]]$params) {
  $size = 3 + $params.Count
  $script:words.Add($size); $script:words.Add(0); $script:words.Add($fn)
  foreach ($p in $params) { $script:words.Add($p) }
}
Add-Rec 0x020b @(0, 0)
Add-Rec 0x020c @(100, 200)
Add-Rec 0x02fc @(0, 0x00ff, 0x0000, 0)
Add-Rec 0x012d @(0)
Add-Rec 0x041b @(100, 200, 0, 0)
Add-Rec 0x02fc @(0, 0x0000, 0x00ff, 0)
Add-Rec 0x012d @(1)
Add-Rec 0x0418 @(90, 180, 10, 20)
Add-Rec 0x0000 @()
$total = 9 + $words.Count
$header = @(1, 9, 0x0300, ($total -band 0xffff), ($total -shr 16), 2, 7, 0, 0)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$placeable = @(0xcdd7, 0x9ac6, 0, 0, 0, 200, 100, 96, 0, 0)
$checksum = 0
foreach ($w in $placeable) { $checksum = $checksum -bxor $w }
foreach ($w in $placeable) { $bw.Write([uint16]$w) }
$bw.Write([uint16]$checksum)
foreach ($w in ($header + $words)) { $bw.Write([uint16]($w -band 0xffff)) }
[System.IO.File]::WriteAllBytes("$work\img.wmf", $ms.ToArray())

'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><rect width="100" height="60" fill="#8a2be2"/><circle cx="50" cy="30" r="20" fill="#ffd700"/></svg>' | Set-Content -Encoding utf8 "$work\img.svg"

$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add($false)
$slide = $pres.Slides.Add(1, 12) # ppLayoutBlank
$x = 10
foreach ($f in 'img.bmp', 'img.gif', 'img.tif', 'img.emf', 'img.wmf', 'img.svg') {
  $p = $slide.Shapes.AddPicture("$work\$f", $false, $true, $x, 20, 100, 60)
  $p.Name = "pic-$f"
  $x += 115
}
$pptx = Join-Path (Resolve-Path $OutDir) 'picture-formats.pptx'
$ppt = Join-Path (Resolve-Path $OutDir) 'picture-formats.powerpoint.ppt'
$pres.SaveAs($pptx, 24)
$pres.SaveAs($ppt, 1)
$pres.Close()
Remove-Item -Recurse -Force $work
"wrote $pptx"
"wrote $ppt"
