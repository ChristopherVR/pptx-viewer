# Captures the OOXML PowerPoint itself writes for the ribbon galleries, so the
# shared gallery catalogues (packages/shared/src/render/ribbon-galleries/) can
# be checked against ground truth rather than guessed.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-gallery-writes-com.ps1 -OutDir <dir>
#
# Writes <OutDir>/gallery-writes.pptx: slide 1 has the 77 Shape Styles
# presets (Shape.ShapeStyle 1..77), slide 2 the WordArt styles
# (TextFrame2.WordArtformat 0..29), slide 3 a table per built-in table style
# probe. Unzip it and read ppt/slides/slideN.xml.
param([Parameter(Mandatory = $true)][string]$OutDir)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutDir | Out-Null
$out = Join-Path (Resolve-Path $OutDir) 'gallery-writes.pptx'
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add($false)

$slide = $pres.Slides.Add(1, 12)
for ($i = 1; $i -le 77; $i++) {
	$col = ($i - 1) % 7
	$row = [math]::Floor(($i - 1) / 7)
	$s = $slide.Shapes.AddShape(1, 10 + $col * 100, 10 + $row * 45, 90, 40)
	$s.Name = "shapeStyle$i"
	try { $s.ShapeStyle = $i } catch { $s.Name = "shapeStyleFail$i" }
}

$slide2 = $pres.Slides.Add(2, 12)
for ($i = 0; $i -le 29; $i++) {
	$col = $i % 5
	$row = [math]::Floor($i / 5)
	$s = $slide2.Shapes.AddTextbox(1, 10 + $col * 180, 10 + $row * 80, 170, 70)
	$s.Name = "wordArt$i"
	$s.TextFrame2.TextRange.Text = 'Abc'
	$s.TextFrame2.TextRange.Font.Size = 36
	try { $s.TextFrame2.WordArtformat = $i } catch { $s.Name = "wordArtFail$i" }
}

$pres.SaveAs($out)
$pres.Close()
$app.Quit()
Write-Output "saved $out"
