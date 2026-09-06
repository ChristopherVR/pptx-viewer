<#
.SYNOPSIS
  Regenerate packages/core/src/__tests__/fixtures/effect-sound-builtin.pptx:
  a real-PowerPoint-authored deck carrying a built-in EFFECT sound (Chime) and
  a built-in TRANSITION sound (Applause), with Microsoft's own WAV bytes
  replaced by a tiny synthesised placeholder before the fixture is committed.

.DESCRIPTION
  This is the ground-truth fixture for the effect-sound stock gallery
  (see packages/shared/src/render/effect-sound-catalogue.ts). It pins, via a
  real PowerPoint 2016 authoring session over COM, EXACTLY what PowerPoint
  itself writes when a user attaches one of its 19 built-in stock sounds to
  an animation effect and to a slide transition:

    - Effect sound: a `p:audio/p:cMediaNode/p:tgtEl/p:sndTgt` node inside the
      effect's own `p:subTnLst` (NOT the legacy `p:stSnd`, which PowerPoint no
      longer recognises back - see native-animation-helpers.ts's
      `extractSoundAction` doc comment).
    - Transition sound: `p:transition/p:sndAc/p:stSnd/p:snd@_name="APPLAUSE.WAV"`.

  Neither carries a `@_builtIn` attribute or any other schema flag: PowerPoint
  identifies a stock sound purely by the `@_name` string matching one of its
  19 known file names. This was COM-verified 2026-09-06 by reopening the
  saved deck and reading `Effect.EffectInformation.SoundEffect.Name`/`.Type`
  and `SlideShowTransition.SoundEffect.Name`/`.Type` back.

  Microsoft's own WAV assets (`...\Office16\Media\CHIMES.WAV`,
  `...\APPLAUSE.WAV`) cannot be redistributed, so after PowerPoint embeds
  them this script overwrites BOTH embedded media parts in place with the
  same tiny synthesised placeholder WAV, preserving the part name, the
  relationship, and the `@_name="CHIMES.WAV"` / `@_name="APPLAUSE.WAV"`
  attributes untouched. The fixture therefore exercises real PowerPoint XML
  shapes without shipping Microsoft's audio.

.NOTES
  Requires a local PowerPoint install (COM). Windows + pwsh only.

.EXAMPLE
  pwsh -File scripts/make-effect-sound-fixture.ps1
#>
param()

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$outDir = Join-Path $env:TEMP 'pptx-effect-sound-fixture'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$rawFile = Join-Path $outDir 'raw.pptx'
$fixtureFile = Join-Path $repoRoot 'packages/core/src/__tests__/fixtures/effect-sound-builtin.pptx'

$media = 'C:\Program Files\Microsoft Office\root\Office16\Media'
$chime = Join-Path $media 'CHIMES.WAV'
$applause = Join-Path $media 'APPLAUSE.WAV'
if (-not (Test-Path $chime) -or -not (Test-Path $applause)) {
  throw "Office stock sound WAVs not found under $media. Update the path for this machine's Office install."
}

# ---- Step 1: author the ground-truth deck via real PowerPoint (COM) ----
$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1
try {
  $pres = $app.Presentations.Add($false)
  $slide = $pres.Slides.Add(1, 11)
  $shape = $slide.Shapes.AddShape(1, 100, 100, 200, 100)
  $shape.TextFrame.TextRange.Text = 'Hello'

  # msoAnimEffectFade = 10, msoAnimTriggerOnPageClick = 1
  $effect = $slide.TimeLine.MainSequence.AddEffect($shape, 10, 0, 1)
  $effect.EffectInformation.SoundEffect.ImportFromFile($chime)

  $slide.SlideShowTransition.SoundEffect.ImportFromFile($applause)

  if (Test-Path $rawFile) { Remove-Item $rawFile -Force }
  $pres.SaveAs($rawFile, 24) # ppSaveAsOpenXMLPresentation
  $pres.Close()
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}

# ---- Step 2: replace both embedded stock-sound media parts with a tiny,
#      deterministic, silent placeholder WAV (same part names, same rels,
#      same @_name attributes; only the audio bytes change). ----
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Minimal valid 16-bit mono PCM WAV, 8000 Hz, 8 silent samples (~1ms).
function New-PlaceholderWavBytes {
  $sampleRate = 8000
  $samples = New-Object 'System.Int16[]' 8
  $dataSize = $samples.Length * 2
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)
  $bw.Write([char[]]'RIFF')
  $bw.Write([int32](36 + $dataSize))
  $bw.Write([char[]]'WAVE')
  $bw.Write([char[]]'fmt ')
  $bw.Write([int32]16)
  $bw.Write([int16]1)      # PCM
  $bw.Write([int16]1)      # mono
  $bw.Write([int32]$sampleRate)
  $bw.Write([int32]($sampleRate * 2))
  $bw.Write([int16]2)      # block align
  $bw.Write([int16]16)     # bits per sample
  $bw.Write([char[]]'data')
  $bw.Write([int32]$dataSize)
  foreach ($s in $samples) { $bw.Write([int16]$s) }
  $bw.Flush()
  return $ms.ToArray()
}

$placeholder = New-PlaceholderWavBytes

if (Test-Path $fixtureFile) { Remove-Item $fixtureFile -Force }
Copy-Item $rawFile $fixtureFile -Force

$zip = [System.IO.Compression.ZipFile]::Open($fixtureFile, 'Update')
try {
  $mediaEntries = $zip.Entries | Where-Object { $_.FullName -match '^ppt/media/audio\d+\.wav$' }
  if ($mediaEntries.Count -lt 2) {
    throw "Expected 2 embedded audioN.wav parts, found $($mediaEntries.Count)."
  }
  foreach ($entry in $mediaEntries) {
    $name = $entry.FullName
    $entry.Delete()
    $newEntry = $zip.CreateEntry($name)
    $entryStream = $newEntry.Open()
    try {
      $entryStream.Write($placeholder, 0, $placeholder.Length)
    } finally {
      $entryStream.Close()
    }
  }
} finally {
  $zip.Dispose()
}

Write-Output "Wrote fixture: $fixtureFile"
Write-Output "Replaced media parts: $(($mediaEntries | ForEach-Object { $_.FullName }) -join ', ')"
