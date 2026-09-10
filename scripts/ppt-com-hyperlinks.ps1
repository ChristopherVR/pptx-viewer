<#
.SYNOPSIS
  Open a legacy binary `.ppt` file through real PowerPoint via COM and
  report every shape's and text-run's `ActionSettings(ppMouseClick)`
  (Action / Hyperlink.Address / Hyperlink.SubAddress), machine-readable and
  stable.

.DESCRIPTION
  The hyperlink/click-action counterpart to `scripts/ppt-com-open.ps1`: that
  script proves slide/shape/text structure survives the binary round-trip,
  but says nothing about `InteractiveInfo` / `ExHyperlink` records. This
  script walks slide 1's shapes (and, for each shape with a text frame,
  every run) and prints one line per action found:

      SHAPE <index> <shapeName>  action=<PpActionType> address=<addr> subaddress=<subaddr>
      RUN <shapeIndex> <runText>  action=<PpActionType> address=<addr>

  Only shapes/runs with a non-"none" (0) action are printed. One line
  `SLIDES=<n>` is printed first.

.PARAMETER Path
  A single `.ppt` path.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Called by
  `scripts/com-acceptance-ppt.mjs`'s hyperlink case.
#>
param(
  [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Continue'

try {
  $app = New-Object -ComObject PowerPoint.Application
} catch {
  "FATAL PowerPoint COM is unavailable: $($_.Exception.Message)"
  exit 2
}
$app.DisplayAlerts = 1  # ppAlertsNone

$resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
$pres = $null
try {
  $pres = $app.Presentations.Open($resolved, $true, $false, $false)
} catch {
  "FAIL $Path  $($_.Exception.Message)"
  $app.Quit()
  exit 1
}

"SLIDES=$($pres.Slides.Count)"

$slide = $pres.Slides.Item(1)
for ($i = 1; $i -le $slide.Shapes.Count; $i++) {
  $sh = $slide.Shapes.Item($i)
  $as = $sh.ActionSettings(1) # ppMouseClick = 1
  if ($as.Action -ne 0) {
    "SHAPE $i $($sh.Name)  action=$($as.Action) address=$($as.Hyperlink.Address) subaddress=$($as.Hyperlink.SubAddress)"
  }
  if ($sh.HasTextFrame -and $sh.TextFrame.HasText) {
    $tr = $sh.TextFrame.TextRange
    $runCount = $tr.Runs().Count
    for ($r = 1; $r -le $runCount; $r++) {
      $run = $tr.Runs($r)
      $ras = $run.ActionSettings(1)
      if ($ras.Action -ne 0) {
        "RUN $i $($run.Text)  action=$($ras.Action) address=$($ras.Hyperlink.Address)"
      }
    }
  }
}

$pres.Close()
$app.Quit()
