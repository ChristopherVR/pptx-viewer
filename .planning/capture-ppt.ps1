Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinHelper2 {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$ppt = Get-Process -Name POWERPNT | Select-Object -First 1
[WinHelper2]::ShowWindow($ppt.MainWindowHandle, 9)
Start-Sleep -Milliseconds 500
[WinHelper2]::SetForegroundWindow($ppt.MainWindowHandle)
Start-Sleep -Milliseconds 1500

$outDir = "D:\Development\pptx-viewer-new\.planning\ppt-screenshots"
[IO.Directory]::CreateDirectory($outDir) | Out-Null

function Cap($n) {
    Start-Sleep -Milliseconds 600
    $s = [System.Windows.Forms.Screen]::PrimaryScreen
    $b = New-Object System.Drawing.Bitmap($s.Bounds.Width, $s.Bounds.Height)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.CopyFromScreen($s.Bounds.Location, [System.Drawing.Point]::Empty, $s.Bounds.Size)
    $b.Save("$outDir\$n.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $b.Dispose()
    Write-Host "OK: $n"
}

# Home tab (should already be selected)
Cap "01-home-tab"

# Insert tab
[System.Windows.Forms.SendKeys]::SendWait("%N")
Start-Sleep -Milliseconds 800
Cap "02-insert-tab"

# Design tab
[System.Windows.Forms.SendKeys]::SendWait("%G")
Start-Sleep -Milliseconds 800
Cap "03-design-tab"

# Transitions tab
[System.Windows.Forms.SendKeys]::SendWait("%K")
Start-Sleep -Milliseconds 800
Cap "04-transitions-tab"

# Animations tab
[System.Windows.Forms.SendKeys]::SendWait("%A")
Start-Sleep -Milliseconds 800
Cap "05-animations-tab"

# Slide Show tab
[System.Windows.Forms.SendKeys]::SendWait("%S")
Start-Sleep -Milliseconds 800
Cap "06-slideshow-tab"

# Review tab
[System.Windows.Forms.SendKeys]::SendWait("%R")
Start-Sleep -Milliseconds 800
Cap "07-review-tab"

# View tab
[System.Windows.Forms.SendKeys]::SendWait("%W")
Start-Sleep -Milliseconds 800
Cap "08-view-tab"

# Back to Home
[System.Windows.Forms.SendKeys]::SendWait("%H")
Write-Host "ALL DONE"
