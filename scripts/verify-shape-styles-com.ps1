# Opens the deck from scripts/make-shape-styles-verify-deck.ts in PowerPoint,
# duplicates every gallery-styled shape, applies PowerPoint's own
# Shape.ShapeStyle preset to the duplicate, and prints both shapes' fill,
# outline, shadow and text colour so the two can be compared.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-shape-styles-com.ps1 -Deck <deck.pptx>
param([Parameter(Mandatory = $true)][string]$Deck)
$ErrorActionPreference = 'Stop'
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Open((Resolve-Path $Deck).Path, $true, $false, $false)
function Describe($s) {
	$line = if ($s.Line.Visible) { '{0:X6}/{1}pt' -f $s.Line.ForeColor.RGB, $s.Line.Weight } else { 'none' }
	'fill={0}:{1:X6} a={2} line={3} shadow={4} text={5:X6}' -f $s.Fill.Type, $s.Fill.ForeColor.RGB,
		[math]::Round(1 - $s.Fill.Transparency, 2), $line, $s.Shadow.Visible,
		$s.TextFrame2.TextRange.Font.Fill.ForeColor.RGB
}
$slide = $pres.Slides(1)
$names = @($slide.Shapes | Where-Object { $_.Name -like 'gallery-*' } | ForEach-Object { $_.Name })
foreach ($name in $names) {
	$s = $slide.Shapes($name)
	$preset = [int]($name.Split('-')[-1])
	$ref = $s.Duplicate().Item(1)
	$ref.ShapeStyle = $preset
	$ours = Describe $s
	$theirs = Describe $ref
	$match = if ($ours -eq $theirs) { 'MATCH' } else { 'DIFF' }
	"$match $name`n  viewer:     $ours`n  powerpoint: $theirs"
}
$pres.Close()
$app.Quit()
