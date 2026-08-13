<#
.SYNOPSIS
  Open .pptx files through the real PowerPoint via COM and report the verdict.

.DESCRIPTION
  This is the ground truth for "does the file we produced actually open".
  Schema reasoning is not a substitute: during the OpenXML parity audit a
  schema-legal `c:lblOffset="100%"` was rejected by PowerPoint, and a suspected
  P0 was downgraded to a P2, both on the strength of this check alone.

  One line per file is written to stdout, machine-readable and stable:

      OK   <path>  slides=<n> shapes=<n>
      FAIL <path>  <message>

  Each presentation is opened read-only, without a window. `DisplayAlerts` is
  set to ppAlertsNone (1) so a repair prompt cannot block the run. Note the
  consequence: PowerPoint may SILENTLY REPAIR a lightly damaged package and
  still report OK. The shape and slide counts are printed for exactly that
  reason, so the caller can compare them against the source deck and catch a
  repair that dropped content. `-ShowAlerts` restores ppAlertsAll (2) if you
  want the dialog to surface interactively.

.PARAMETER Paths
  One or more .pptx paths. Wildcards are not expanded; pass real paths.

.PARAMETER ShowAlerts
  Set DisplayAlerts to ppAlertsAll so repair prompts are shown. Interactive use
  only: it will block an unattended run.

.EXAMPLE
  pwsh -File scripts/pptx-com-open.ps1 out/*.pptx

.NOTES
  Requires a local PowerPoint install. Called by `scripts/com-acceptance.mjs`,
  which is the entry point you normally want.
#>
param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Paths,
  [switch]$ShowAlerts
)

$ErrorActionPreference = 'Continue'

try {
  $app = New-Object -ComObject PowerPoint.Application
} catch {
  "FATAL PowerPoint COM is unavailable: $($_.Exception.Message)"
  exit 2
}

# ppAlertsNone = 1, ppAlertsAll = 2.
$app.DisplayAlerts = if ($ShowAlerts) { 2 } else { 1 }

$failures = 0
foreach ($p in $Paths) {
  $resolved = $null
  try {
    $resolved = (Resolve-Path -LiteralPath $p -ErrorAction Stop).Path
  } catch {
    "FAIL $p  file not found"
    $failures++
    continue
  }
  $pres = $null
  try {
    # Open(FileName, ReadOnly, Untitled, WithWindow)
    $pres = $app.Presentations.Open($resolved, $true, $false, $false)
    $slides = $pres.Slides.Count
    $shapes = 0
    foreach ($s in $pres.Slides) { $shapes += $s.Shapes.Count }
    "OK   $resolved  slides=$slides shapes=$shapes"
  } catch {
    "FAIL $resolved  $($_.Exception.Message -replace '\r?\n', ' ')"
    $failures++
  } finally {
    if ($null -ne $pres) { try { $pres.Close() } catch { } }
  }
}

try { $app.Quit() } catch { }
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
exit ([Math]::Min($failures, 1))
