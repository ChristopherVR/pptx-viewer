<#
.SYNOPSIS
  Open one or more legacy binary `.ppt` files through real PowerPoint via
  COM, reporting pass/fail plus a text read-back per file, machine-readable
  and stable.

.DESCRIPTION
  The `.ppt`-specific counterpart to `scripts/pptx-com-open.ps1`: that script
  reports slide/shape counts for OOXML `.pptx` fixtures, but this project's
  `.ppt` writer needed a text READ-BACK too (`Shapes(1).TextFrame.TextRange.Text`)
  to prove content survives the binary round-trip, not just structure.

  One line per file is written to stdout:

      OK   <path>  slides=<n> shapes=<n> text=<base64>
      FAIL <path>  <message>

  The read-back text is base64-encoded so embedded newlines/pipes in slide
  text cannot break the one-line-per-file stdout contract
  `com-acceptance-ppt.mjs` parses. All files are opened in ONE PowerPoint
  session, matching `pptx-com-open.ps1`/`batch-open.ps1`'s convention.

.PARAMETER Paths
  One or more `.ppt` paths.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Called by
  `scripts/com-acceptance-ppt.mjs`, which is the entry point you normally want.
#>
param(
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Paths
)

$ErrorActionPreference = 'Continue'

try {
  $app = New-Object -ComObject PowerPoint.Application
} catch {
  "FATAL PowerPoint COM is unavailable: $($_.Exception.Message)"
  exit 2
}

$app.DisplayAlerts = 1  # ppAlertsNone

foreach ($p in $Paths) {
  $resolved = $null
  try {
    $resolved = (Resolve-Path -LiteralPath $p -ErrorAction Stop).Path
  } catch {
    "FAIL $p  file not found"
    continue
  }
  $pres = $null
  try {
    $pres = $app.Presentations.Open($resolved, $true, $false, $false)
    $slides = $pres.Slides.Count
    $shapes = 0
    foreach ($s in $pres.Slides) { $shapes += $s.Shapes.Count }
    $text = ''
    if ($slides -gt 0 -and $pres.Slides.Item(1).Shapes.Count -gt 0) {
      $text = $pres.Slides.Item(1).Shapes.Item(1).TextFrame.TextRange.Text
    }
    $textB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($text))
    "OK   $resolved  slides=$slides shapes=$shapes text=$textB64"
  } catch {
    "FAIL $resolved  $($_.Exception.Message -replace '\r?\n', ' ')"
  } finally {
    if ($null -ne $pres) { try { $pres.Close() } catch { } }
  }
}

try { $app.Quit() } catch { }
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
