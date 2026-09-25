# Ground truth for the data-driven ribbon galleries (Table Styles, Chart
# Colors, Chart Quick Layout, SmartArt styles/colours) in
# packages/shared/src/render/ribbon-galleries/.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-data-galleries-com.ps1 -OutDir <dir>
#
# Writes <OutDir>/data-galleries.pptx and <OutDir>/data-galleries.json:
#   - slide 1: a table whose cells carry direct fills, then Table.ApplyStyle(guid)
#     (read the saved a:tcPr to see whether PowerPoint cleared the fills);
#   - slides 2..18: a 4-series clustered column chart per Chart.ChartColor 10..26
#     (read ppt/charts/colorsN.xml and the c:ser/c:spPr fills);
#   - json.layouts: per Chart.ApplyLayout(1..11) the element state PowerPoint reports;
#   - json.smartArtStyles / smartArtColors: Application.SmartArtQuickStyles/Colors names.
param([Parameter(Mandatory = $true)][string]$OutDir)
$ErrorActionPreference = 'Stop'
trap { Write-Output $_.InvocationInfo.PositionMessage; Write-Output $_.Exception.Message; try { $pres.Close() } catch {}; if ($app.Presentations.Count -eq 0) { $app.Quit() }; exit 1 }
New-Item -ItemType Directory -Force $OutDir | Out-Null
$root = Resolve-Path $OutDir
$out = Join-Path $root 'data-galleries.pptx'
$app = New-Object -ComObject PowerPoint.Application
$pres = $app.Presentations.Add()
$result = [ordered]@{}

# --- table: direct fills, then a style ------------------------------------
$slide = $pres.Slides.Add(1, 12)
$t = $slide.Shapes.AddTable(3, 3, 20, 20, 400, 150)
$t.Name = 'styledTable'
$t.Table.Cell(1, 1).Shape.Fill.ForeColor.RGB = 0x0000FF
$t.Table.Cell(2, 2).Shape.Fill.ForeColor.RGB = 0x00FF00
$t.Table.Cell(2, 2).Shape.TextFrame.TextRange.Text = 'direct'
$t.Table.ApplyStyle('{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}', $false) # Medium Style 2
$result.tableStyleAfterApply = [ordered]@{
	id = $t.Table.Style.Id
	name = $t.Table.Style.Name
	cell11 = $t.Table.Cell(1, 1).Shape.Fill.ForeColor.RGB
	cell22 = $t.Table.Cell(2, 2).Shape.Fill.ForeColor.RGB
}
$t2 = $slide.Shapes.AddTable(3, 3, 20, 200, 400, 150)
$t2.Name = 'styledTableKeep'
$t2.Table.Cell(2, 2).Shape.Fill.ForeColor.RGB = 0x00FF00
$t2.Table.ApplyStyle('{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}', $true)
$t3 = $slide.Shapes.AddTable(3, 3, 450, 20, 400, 150)
$t3.Name = 'styledTableDefault'
$t3.Table.Cell(2, 2).Shape.Fill.ForeColor.RGB = 0x00FF00
$t3.Table.ApplyStyle('{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}')
$result.tableStyleDefaultArg = [ordered]@{
	id = $t3.Table.Style.Id
	cell22 = $t3.Table.Cell(2, 2).Shape.Fill.ForeColor.RGB
}

# --- charts: Change Colors ------------------------------------------------
function Add-FourSeriesChart($slide) {
	$shape = $slide.Shapes.AddChart2(-1, 51, 20, 20, 480, 300, $true)
	$shape.Chart.ChartData.Activate()
	$wb = $null
	for ($a = 0; $a -lt 25 -and $null -eq $wb; $a++) { Start-Sleep -Milliseconds 400; try { $wb = $shape.Chart.ChartData.Workbook } catch { $wb = $null } }
	if ($null -eq $wb) { throw 'ChartData.Workbook never attached' }
	$ws = $wb.Worksheets(1)
	$ws.Range('E1').Value2 = 'Series 4'
	$ws.Range('E2:E5').Value2 = 3
	$shape.Chart.SetSourceData("='Sheet1'!`$A`$1:`$E`$5")
	$wb.Close()
	return $shape
}
$colors = @()
for ($c = 10; $c -le 26; $c++) {
	$s = $pres.Slides.Add($pres.Slides.Count + 1, 12)
	$shape = Add-FourSeriesChart $s
	$shape.Name = "chartColor$c"
	$shape.Chart.ChartColor = $c
	$fills = @()
	for ($i = 1; $i -le $shape.Chart.SeriesCollection().Count; $i++) {
		$fills += $shape.Chart.SeriesCollection($i).Format.Fill.ForeColor.RGB
	}
	$colors += [ordered]@{ chartColor = $c; readBack = $shape.Chart.ChartColor; seriesRgb = $fills }
}
$result.chartColors = $colors

# --- charts: Quick Layout -------------------------------------------------
$ls = $pres.Slides.Add($pres.Slides.Count + 1, 12)
$lc = Add-FourSeriesChart $ls
$lc.Name = 'quickLayout'
$layouts = @()
for ($n = 1; $n -le 11; $n++) {
	$ch = $lc.Chart
	$ch.ApplyLayout($n)
	$labels = $false
	$labelVal = $false
	$labelCat = $false
	$labelSer = $false
	$labelPos = $null
	try {
		$ser = $ch.SeriesCollection(1)
		$labels = [bool]$ser.HasDataLabels
		if ($labels) {
			$dl = $ser.DataLabels()
			$labelVal = [bool]$dl.ShowValue
			$labelCat = [bool]$dl.ShowCategoryName
			$labelSer = [bool]$dl.ShowSeriesName
			$labelPos = $dl.Position
		}
	} catch {}
	$catAx = $ch.Axes(1, 1)
	$valAx = $ch.Axes(2, 1)
	$layouts += [ordered]@{
		layout = $n
		hasTitle = [bool]$ch.HasTitle
		hasLegend = [bool]$ch.HasLegend
		legendPosition = $(if ($ch.HasLegend) { $ch.Legend.Position } else { $null })
		hasDataTable = [bool]$ch.HasDataTable
		dataTableKeys = $(if ($ch.HasDataTable) { [bool]$ch.DataTable.ShowLegendKey } else { $null })
		dataLabels = $labels
		labelValue = $labelVal
		labelCategory = $labelCat
		labelSeries = $labelSer
		labelPosition = $labelPos
		catAxisTitle = [bool]$catAx.HasTitle
		valAxisTitle = [bool]$valAx.HasTitle
		catMajorGrid = [bool]$catAx.HasMajorGridlines
		valMajorGrid = [bool]$valAx.HasMajorGridlines
		valMinorGrid = [bool]$valAx.HasMinorGridlines
		hasCatAxis = [bool]$ch.HasAxis(1, 1)
		hasValAxis = [bool]$ch.HasAxis(2, 1)
		gapWidth = $ch.ChartGroups(1).GapWidth
		overlap = $ch.ChartGroups(1).Overlap
	}
}
$result.layouts = $layouts

# --- SmartArt gallery names ----------------------------------------------
$styles = @()
for ($i = 1; $i -le $app.SmartArtQuickStyles.Count; $i++) {
	$q = $app.SmartArtQuickStyles.Item($i)
	$styles += [ordered]@{ i = $i; name = $q.Name; id = $q.Id; category = $q.Category }
}
$result.smartArtStyles = $styles
$scs = @()
for ($i = 1; $i -le $app.SmartArtColors.Count; $i++) {
	$q = $app.SmartArtColors.Item($i)
	$scs += [ordered]@{ i = $i; name = $q.Name; id = $q.Id; category = $q.Category }
}
$result.smartArtColors = $scs

$pres.SaveAs($out)
$pres.Close()
if ($app.Presentations.Count -eq 0) { $app.Quit() }
$result | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 (Join-Path $root 'data-galleries.json')
Write-Output "saved $out"
