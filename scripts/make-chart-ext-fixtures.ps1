<#
.SYNOPSIS
  Build the fixtures for the three remaining passthrough-only Office chart
  extensions: c15:filteredSeriesTitle / c15:filteredCategoryTitle, and
  c15:datalabelsRange / c15:dlblRangeCache / c15:xForSave.

.DESCRIPTION
  Every PowerPoint 2016 COM automation path tried here FAILED to write these
  extensions, so the fixtures are hand-authored (per the published
  [MS-ODRAWXML] schema) into a genuine COM-authored base chart, then verified
  ONLY by confirming PowerPoint opens the result without repairing it
  (`pptx-com-open.ps1`), not by round-tripping through a PowerPoint SaveAs:
  PowerPoint's own serializer silently DROPS extLst content its live object
  model does not recognise, so a COM re-save destroys the very extensions
  under test (confirmed below, see "PowerPoint drops foreign extLst content").

  COM attempts that did NOT produce c15:filteredSeriesTitle / c15:filteredCategoryTitle:
    - `Chart.SeriesCollection(n).IsFiltered = $true` on a series whose name/
      title is a cell reference: produces `c15:filteredBarSeries` (already
      modelled) but never `c15:filteredSeriesTitle`.
    - Linking `Chart.ChartTitle.Formula` to the filtered series' own header
      cell before filtering it: PowerPoint keeps the title's plain
      `c:strCache` (still showing the old series name) and writes NO
      extension at all for it.
    - `ChartGroup.FullCategoryCollection().Item(n).IsFiltered = $true` on a
      scatter chart (to reach `c15:xForSave`'s scatter/bubble scenario):
      throws "Selection not valid" from PowerPoint's own COM surface, so it
      cannot be driven this way at all in this Office build.

  COM attempts that did NOT produce c15:datalabelsRange (the range formula):
    - `Series.DataLabels.ShowRange = $true` DOES round-trip as a genuine
      `c15:showDataLabelsRange` group-level flag inside
      `c:ser/c:dLbls/c:extLst/c:ext[@uri={CE6537A1-...}]` (confirmed below,
      this part of the fixture IS genuine PowerPoint output) - but there is
      no discoverable settable property for the underlying range formula
      itself (`DataLabelRange`, `ValuesRange`, `Range` all throw "cannot be
      found on this object"), and PowerPoint's "Value From Cells" dialog is
      not macro-recordable. The workbook side offers no chart-object route
      either (`Chart.ChartData.Workbook` has no `ChartObjects`/`Charts`
      collection for a PowerPoint-embedded chart).

  "PowerPoint drops foreign extLst content" (why a COM re-save cannot be the
  fixture): hand-authoring the four extensions into a genuine base and then
  opening + `SaveAs`-ing it through PowerPoint COM (`resave.ps1` during
  development of this script) produced a FILE PowerPoint opened cleanly, but
  the re-saved XML had SILENTLY DROPPED every one of the four hand-authored
  elements: PowerPoint's serializer re-emits only what its own live object
  model tracks (which correctly regenerated `c15:filteredBarSeries` from
  `Series.IsFiltered` and `c15:showDataLabelsRange`/`c15:showLeaderLines`
  from the real dLbls state), not "foreign" extLst content no API path set.
  The pre-resave, hand-authored file is therefore the fixture; ground truth
  is "PowerPoint opens it without repair and with unchanged shape/slide
  counts" (`pptx-com-open.ps1`), not "PowerPoint's own serializer agrees".

.NOTES
  Requires a local PowerPoint install and Node.js (for the zip-level XML
  surgery via `jszip`, already a repo dependency). Run from the repo root:
    pwsh -File scripts/make-chart-ext-fixtures.ps1
  Output: e2e/fixtures/chart-ext-filtered-titles.pptx,
          e2e/fixtures/chart-ext-datalabels-range.pptx
#>
param(
  [string]$OutDir = (Join-Path $PSScriptRoot '..\e2e\fixtures')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$work = Join-Path ([System.IO.Path]::GetTempPath()) ("chart-ext-fixtures-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $work | Out-Null

function New-BaseColumnChartWithLinkedNames {
  <# A 2-series column chart via AddChart2 whose series names/titles resolve
     to workbook cell references (PowerPoint's own default), matching the
     shape c15:filteredSeriesTitle would apply to. #>
  param([string]$OutPath)
  $app = New-Object -ComObject PowerPoint.Application
  $app.DisplayAlerts = 1
  $pres = $null
  try {
    $pres = $app.Presentations.Add()
    $slide = $pres.Slides.Add(1, 12)
    $chartShape = $slide.Shapes.AddChart2(-1, 51, 50, 50, 500, 350)
    $chart = $chartShape.Chart
    $chart.ChartData.Activate()
    # The embedded Excel instance can take a moment to attach, especially
    # under concurrent COM load elsewhere on the machine; poll rather than
    # fail on the first null Workbook.
    $wb = $null
    for ($attempt = 0; $attempt -lt 10 -and $null -eq $wb; $attempt++) {
      Start-Sleep -Milliseconds 500
      try { $wb = $chart.ChartData.Workbook } catch { $wb = $null }
    }
    if ($null -eq $wb) {
      throw 'ChartData.Workbook never attached (embedded Excel did not start in time)'
    }
    $ws = $wb.Sheets.Item(1)
    $ws.Cells.Item(1, 4).Value2 = 'Label'
    $ws.Cells.Item(2, 4).Value2 = 'Low'
    $ws.Cells.Item(3, 4).Value2 = 'Medium'
    $ws.Cells.Item(4, 4).Value2 = 'High'
    $ws.Cells.Item(5, 4).Value2 = 'Top'

    $ser1 = $chart.SeriesCollection().Item(1)
    $ser1.HasDataLabels = $true
    $ser1.DataLabels().ShowRange = $true

    $wb.Close()
    if (Test-Path $OutPath) { Remove-Item $OutPath }
    $pres.SaveAs($OutPath)
    Write-Output "OK   built $OutPath"
  } finally {
    if ($null -ne $pres) { try { $pres.Close() } catch {} }
    try { $app.Quit() } catch {}
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
  }
}

# ── Base A: reuse the existing genuine filteredBarSeries fixture ──────────
$baseFilteredSeries = Join-Path $repoRoot 'e2e\fixtures\chart-filtered-series.pptx'
if (-not (Test-Path $baseFilteredSeries)) {
  throw "missing base fixture: $baseFilteredSeries"
}

# ── Base B: a fresh column chart with a real showDataLabelsRange flag ─────
$baseDataLabelsRange = Join-Path $work 'base-datalabels-range.pptx'
New-BaseColumnChartWithLinkedNames -OutPath $baseDataLabelsRange

# ── Hand-author the four extensions via a small Node/jszip helper ────────
$injectScript = Join-Path $work 'inject.mjs'
@'
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const JSZip = require(process.argv[5]);

const [, , mode, inPath, outPath] = process.argv;
const zip = await JSZip.loadAsync(readFileSync(inPath));
const chartPath = "ppt/charts/chart1.xml";
let xml = await zip.file(chartPath).async("string");

if (mode === "titles") {
  const seriesTitle =
    "<c15:filteredSeriesTitle><c15:tx><c:strRef><c:f>Sheet1!$D$1</c:f>" +
    "<c:strCache><c:ptCount val=\"1\"/><c:pt idx=\"0\"><c:v>Series 3</c:v></c:pt></c:strCache>" +
    "</c:strRef></c15:tx></c15:filteredSeriesTitle>";
  const categoryTitle =
    "<c15:filteredCategoryTitle><c15:cat><c:numRef><c:f>Sheet1!$A$6:$A$8</c:f>" +
    "<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val=\"3\"/>" +
    "<c:pt idx=\"0\"><c:v>5</c:v></c:pt><c:pt idx=\"1\"><c:v>6</c:v></c:pt>" +
    "<c:pt idx=\"2\"><c:v>7</c:v></c:pt></c:numCache></c:numRef></c15:cat></c15:filteredCategoryTitle>";
  const marker = "</c15:filteredBarSeries>";
  if (!xml.includes(marker)) throw new Error("marker not found: " + marker);
  xml = xml.replace(marker, marker + seriesTitle + categoryTitle);
} else if (mode === "datalabelsrange") {
  const rangeMarker = '<c15:showDataLabelsRange val="1"/>';
  if (!xml.includes(rangeMarker)) throw new Error("marker not found: " + rangeMarker);
  const rangeExt =
    "<c15:datalabelsRange><c15:f>Sheet1!$D$2:$D$5</c15:f>" +
    "<c15:dlblRangeCache><c:ptCount val=\"4\"/>" +
    "<c:pt idx=\"0\"><c:v>Low</c:v></c:pt><c:pt idx=\"1\"><c:v>Medium</c:v></c:pt>" +
    "<c:pt idx=\"2\"><c:v>High</c:v></c:pt><c:pt idx=\"3\"><c:v>Top</c:v></c:pt>" +
    "</c15:dlblRangeCache></c15:datalabelsRange>";
  xml = xml.replace(rangeMarker, rangeMarker + rangeExt);

  const dLblsMarker = "<c:dLbls><c:spPr>";
  if (!xml.includes(dLblsMarker)) throw new Error("marker not found: " + dLblsMarker);
  const dLbl =
    '<c:dLbl><c:idx val="0"/><c:showVal val="1"/><c:extLst>' +
    '<c:ext uri="{CE6537A1-D6FC-4f65-9D91-7224C49458BB}" xmlns:c15="http://schemas.microsoft.com/office/drawing/2012/chart">' +
    "<c15:xForSave val=\"1\"/></c:ext></c:extLst></c:dLbl>";
  xml = xml.replace(dLblsMarker, "<c:dLbls>" + dLbl + "<c:spPr>");
} else {
  throw new Error("unknown mode: " + mode);
}

zip.file(chartPath, xml);
writeFileSync(outPath, await zip.generateAsync({ type: "nodebuffer" }));
console.log("wrote", outPath);
'@ | Set-Content -Path $injectScript -Encoding utf8

$jszipEntry = Join-Path $repoRoot 'node_modules\jszip\lib\index.js'
$rawTitles = Join-Path $work 'raw-titles.pptx'
$rawDataLabelsRange = Join-Path $work 'raw-datalabelsrange.pptx'
node $injectScript titles $baseFilteredSeries $rawTitles $jszipEntry
node $injectScript datalabelsrange $baseDataLabelsRange $rawDataLabelsRange $jszipEntry

# ── Verify PowerPoint opens both without repair ───────────────────────────
& pwsh -File (Join-Path $repoRoot 'scripts\pptx-com-open.ps1') $rawTitles $rawDataLabelsRange $baseFilteredSeries

# ── Publish ────────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Copy-Item $rawTitles (Join-Path $OutDir 'chart-ext-filtered-titles.pptx') -Force
Copy-Item $rawDataLabelsRange (Join-Path $OutDir 'chart-ext-datalabels-range.pptx') -Force
Write-Output "Fixtures written to $OutDir"
