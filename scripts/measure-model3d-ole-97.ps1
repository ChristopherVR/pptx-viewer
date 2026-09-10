<#
.SYNOPSIS
  One-off measurement (not a fixture generator): what does real PowerPoint
  16.0 itself do with a 3D model (Insert > 3D Models, `Shapes.Add3DModel`,
  the same DrawingML `p16:model3D` this project's own writer/reader parse
  in packages/core/src/core/utils/model3d-parser.ts) when it saves a deck
  as 97-2003 (.ppt)? Task-scoped for the limitations.md `.ppt` degradation
  row: this writer does not attempt to write a native 3D model into a
  binary .ppt shape and instead degrades it to a picture/placeholder like
  a chart; this script checks whether that degradation matches PowerPoint's
  OWN ceiling on the same content, the same question already answered for
  charts (measure-chart-ole-97.ps1) and audio (ppt-com-media.ps1).

.DESCRIPTION
  Builds a minimal, spec-valid binary glTF (.glb) containing one triangle
  mesh entirely in-script (no external asset dependency), inserts it via
  `Shapes.Add3DModel(FileName, LinkToFile, Left, Top, Width, Height)`
  (LinkToFile = $false so the bytes are embedded, matching how this
  project's own SDK authors a `model3d` element), saves the deck as .ppt
  (SaveAs format 1 = ppSaveAsPresentation), then reopens the SAVED FILE
  through a second, independent Presentations.Open call (not the in-memory
  object still held by the first session) and reports the resulting
  shape's Type and, when present, OLEFormat.ProgID/HasChart - the same
  measurement measure-chart-ole-97.ps1 and ppt-com-ole.ps1 already use.

.NOTES
  Requires a local PowerPoint install. Windows + pwsh only. Not part of
  any test run; run manually when re-verifying the limitations.md 3D-model
  claim. `Shapes.Add3DModel` was confirmed present on this machine's
  PowerPoint 16.0 by probing argument counts (`Shapes.AddModel3D`,
  `AddPicture3D`, `AddModel`, `InsertModel3D` do not exist; `Add3DModel`
  does, and only the 6-argument
  `(FileName, LinkToFile, Left, Top, Width, Height)` overload resolved).
#>
param()

$ErrorActionPreference = 'Stop'
$glbPath = Join-Path $env:TEMP 'measure-model3d-triangle.glb'
$outPath = Join-Path $env:TEMP 'measure-model3d-ole-97.ppt'

# ---- Build a minimal, spec-valid binary glTF (one triangle) ----
function New-MinimalGlb {
  param([string]$Path)

  $json =
    '{"asset":{"version":"2.0","generator":"pptx-viewer-limitations-measurement"},' +
    '"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0}],' +
    '"meshes":[{"primitives":[{"attributes":{"POSITION":0}}]}],' +
    '"buffers":[{"byteLength":36}],' +
    '"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":36,"target":34962}],' +
    '"accessors":[{"bufferView":0,"byteOffset":0,"componentType":5126,"count":3,' +
    '"type":"VEC3","max":[1,1,0],"min":[0,0,0]}]}'
  while (([System.Text.Encoding]::UTF8.GetByteCount($json)) % 4 -ne 0) { $json += ' ' }
  $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)

  # Triangle vertices (0,0,0) (1,0,0) (0,1,0) as 9 little-endian float32s.
  $floats = [float[]]@(0, 0, 0, 1, 0, 0, 0, 1, 0)
  $binBytes = New-Object byte[] ($floats.Length * 4)
  for ($i = 0; $i -lt $floats.Length; $i++) {
    [System.BitConverter]::GetBytes($floats[$i]).CopyTo($binBytes, $i * 4)
  }

  $totalLength = 12 + 8 + $jsonBytes.Length + 8 + $binBytes.Length

  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)
  $bw.Write([System.BitConverter]::GetBytes([uint32]0x46546C67)) # 'glTF'
  $bw.Write([uint32]2) # version
  $bw.Write([uint32]$totalLength)
  $bw.Write([uint32]$jsonBytes.Length)
  $bw.Write([System.BitConverter]::GetBytes([uint32]0x4E4F534A)) # 'JSON'
  $bw.Write($jsonBytes)
  $bw.Write([uint32]$binBytes.Length)
  $bw.Write([System.BitConverter]::GetBytes([uint32]0x004E4942)) # 'BIN\0'
  $bw.Write($binBytes)
  $bw.Flush()
  [System.IO.File]::WriteAllBytes($Path, $ms.ToArray())
}

New-MinimalGlb -Path $glbPath
"Wrote $glbPath ($((Get-Item $glbPath).Length) bytes)"

$app = New-Object -ComObject PowerPoint.Application
$app.DisplayAlerts = 1
$app.Visible = $true
try {
  $pres = $app.Presentations.Add($true)
  $slide = $pres.Slides.Add(1, 11) # ppLayoutBlank = 11
  $shape = $slide.Shapes.Add3DModel($glbPath, $false, 50, 50, 300, 200)
  "INSERTED Shape.Type=$($shape.Type) Name=$($shape.Name)"

  if (Test-Path $outPath) { Remove-Item $outPath -Force }
  $pres.SaveAs($outPath, 1) # ppSaveAsPresentation (97-2003 .ppt)
  $pres.Close()
} finally {
  $app.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null
}

# ---- Reopen the saved .ppt through a FRESH session and report ----
$app2 = New-Object -ComObject PowerPoint.Application
$app2.DisplayAlerts = 1
try {
  $pres2 = $app2.Presentations.Open($outPath, $true, $false, $false)
  $slide2 = $pres2.Slides.Item(1)
  for ($i = 1; $i -le $slide2.Shapes.Count; $i++) {
    $sh = $slide2.Shapes.Item($i)
    $progid = ''
    try { $progid = $sh.OLEFormat.ProgID } catch { $progid = '(none)' }
    $hasChart = 'n/a'
    try { $hasChart = $sh.HasChart } catch { $hasChart = '(error)' }
    "SHAPE $i type=$($sh.Type) progid=$progid hasChart=$hasChart"
  }
  $pres2.Close()
} finally {
  $app2.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app2) | Out-Null
}

"Saved+reopened: $outPath"
