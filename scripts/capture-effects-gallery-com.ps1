# Captures the OOXML PowerPoint writes for the Shape Effects gallery families
# and the Bullets / Numbering libraries, so the shared catalogues in
# packages/shared/src/render/ribbon-galleries/ are checked against ground
# truth rather than guessed.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-effects-gallery-com.ps1 -OutDir <dir>
#
# Writes <OutDir>/effects-writes.pptx:
#   slide 1: shadow1..43       (Shape.Shadow.Type = msoShadow1..43)
#   slide 2: reflection1..9    (Shape.Reflection.Type = msoReflectionType1..9)
#            softEdge1..6      (Shape.SoftEdge.Type = msoSoftEdgeType1..6)
#            glow-<pt>-<accent> (Glow.Radius + Color.ObjectThemeColor + Transparency 0.6)
#   slide 3: bevel2..13        (ThreeD.BevelTopType = msoBevelType 2..13)
#            camera<n>         (ThreeD.SetPresetCamera(n))
#   slide 4: bullets / numbering text boxes; <OutDir>/bullets.txt holds the
#            Bullet.Character / Font.Name / Style COM reads.
param([Parameter(Mandatory = $true)][string]$OutDir)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $OutDir | Out-Null
$out = Join-Path (Resolve-Path $OutDir) 'effects-writes.pptx'
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add($false)

function Add-Box($slide, $i, $name) {
	$col = $i % 10
	$row = [math]::Floor($i / 10)
	$s = $slide.Shapes.AddShape(1, 10 + $col * 90, 10 + $row * 60, 70, 45)
	$s.Name = $name
	return $s
}

$s1 = $pres.Slides.Add(1, 12)
for ($i = 1; $i -le 43; $i++) {
	$s = Add-Box $s1 ($i - 1) "shadow$i"
	try { $s.Shadow.Type = $i } catch { $s.Name = "shadowFail$i" }
}

$s2 = $pres.Slides.Add(2, 12)
$n = 0
for ($i = 1; $i -le 9; $i++) {
	$s = Add-Box $s2 $n "reflection$i"; $n++
	try { $s.Reflection.Type = $i } catch { $s.Name = "reflectionFail$i" }
}
for ($i = 1; $i -le 6; $i++) {
	$s = Add-Box $s2 $n "softEdge$i"; $n++
	try { $s.SoftEdge.Type = $i } catch { $s.Name = "softEdgeFail$i" }
}
foreach ($pt in 5, 8, 11, 18) {
	for ($a = 1; $a -le 6; $a++) {
		$s = Add-Box $s2 $n "glow-$pt-$a"; $n++
		$s.Glow.Radius = $pt
		$s.Glow.Color.ObjectThemeColor = 4 + $a
		$s.Glow.Transparency = 0.6
	}
}

$s3 = $pres.Slides.Add(3, 12)
$n = 0
for ($i = 2; $i -le 13; $i++) {
	$s = Add-Box $s3 $n "bevel$i"; $n++
	try { $s.ThreeD.BevelTopType = $i } catch { $s.Name = "bevelFail$i" }
}
for ($i = 1; $i -le 62; $i++) {
	$s = Add-Box $s3 $n "camera$i"; $n++
	try { $s.ThreeD.SetPresetCamera($i) } catch { $s.Name = "cameraFail$i" }
}

$s4 = $pres.Slides.Add(4, 12)
$log = @()
# ppBulletUnnumbered = 1, ppBulletNumbered = 2
$chars = @(
	@{ n = 'filledRound'; c = 0x2022; f = 'Arial' },
	@{ n = 'hollowRound'; c = 0x6F; f = 'Courier New' },
	@{ n = 'filledSquare'; c = 0xA7; f = 'Wingdings' },
	@{ n = 'hollowSquare'; c = 0x71; f = 'Wingdings' },
	@{ n = 'star'; c = 0x76; f = 'Wingdings' },
	@{ n = 'arrow'; c = 0xD8; f = 'Wingdings' },
	@{ n = 'check'; c = 0xFC; f = 'Wingdings' }
)
$k = 0
foreach ($b in $chars) {
	$t = $s4.Shapes.AddTextbox(1, 10 + ($k % 4) * 230, 10 + [math]::Floor($k / 4) * 120, 220, 100); $k++
	$t.Name = "bullet-$($b.n)"
	$t.TextFrame.TextRange.Text = "One`rTwo"
	$pf = $t.TextFrame.TextRange.ParagraphFormat
	$pf.Bullet.Type = 1
	$pf.Bullet.Font.Name = $b.f
	$pf.Bullet.Character = $b.c
}
# ppBulletArabicPeriod 3, ArabicParenRight 2, RomanUCPeriod 4? use names via numeric probe
foreach ($style in 1..12) {
	$t = $s4.Shapes.AddTextbox(1, 10 + ($k % 4) * 230, 10 + [math]::Floor($k / 4) * 120, 220, 100); $k++
	$t.Name = "numbering-$style"
	$t.TextFrame.TextRange.Text = "One`rTwo"
	$pf = $t.TextFrame.TextRange.ParagraphFormat
	$pf.Bullet.Type = 2
	try { $pf.Bullet.Style = $style } catch { $t.Name = "numberingFail-$style" }
}

$pres.SaveAs($out)
$pres.Close()
$app.Quit()
Write-Output "saved $out"
