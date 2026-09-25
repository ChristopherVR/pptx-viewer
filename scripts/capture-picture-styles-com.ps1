# Captures the OOXML PowerPoint writes for every built-in Picture Style
# (Picture Format > Picture Styles), so the shared catalogue in
# packages/shared/src/render/ribbon-galleries/picture-styles-catalog.ts is
# checked against ground truth rather than guessed.
#
# The object model has no picture-style API, so this drives the ribbon with
# UI Automation: PowerPoint is made visible, each picture is selected, the
# Picture Styles gallery is dropped down and the tile is invoked by name.
# Leave the PowerPoint window alone while it runs.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-picture-styles-com.ps1 -OutDir <dir>
#
# Writes <OutDir>/picture-styles.pptx (one slide per style, the picture named
# "style-<n>") and <OutDir>/picture-styles.txt (the gallery's tile names in
# order).
param([Parameter(Mandatory = $true)][string]$OutDir)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing
New-Item -ItemType Directory -Force $OutDir | Out-Null
$root = (Resolve-Path $OutDir).Path
$png = Join-Path $root 'picture-styles-source.png'
$bmp = New-Object System.Drawing.Bitmap 64, 48
$gfx = [System.Drawing.Graphics]::FromImage($bmp); $gfx.Clear([System.Drawing.Color]::SteelBlue); $gfx.Dispose()
$bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()

$A = [System.Windows.Automation.AutomationElement]
$T = [System.Windows.Automation.TreeScope]
$CT = [System.Windows.Automation.ControlType]

function Find-Element($scope, $name, $type, $automationId) {
	$conds = @()
	if ($name) { $conds += New-Object System.Windows.Automation.PropertyCondition($A::NameProperty, $name) }
	if ($type) { $conds += New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $type) }
	if ($automationId) { $conds += New-Object System.Windows.Automation.PropertyCondition($A::AutomationIdProperty, $automationId) }
	$cond = if ($conds.Count -eq 1) { $conds[0] } else { New-Object System.Windows.Automation.AndCondition($conds) }
	for ($i = 0; $i -lt 20; $i++) {
		$found = $scope.FindFirst($T::Descendants, $cond)
		if ($found) { return $found }
		Start-Sleep -Milliseconds 300
	}
	throw "UIA element not found: $name / $automationId"
}

function Open-Gallery($app) {
	$win = $A::FromHandle([IntPtr]$app.HWND)
	$tab = Find-Element $win 'Picture Format' $CT::TabItem $null
	$tab.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select()
	$script:gallery = Find-Element $win $null $null 'PictureStylesGallery'
	$script:gallery.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand()
	Start-Sleep -Milliseconds 800
	return $A::RootElement
}

$app = New-Object -ComObject PowerPoint.Application
$app.Visible = -1
$pres = $app.Presentations.Add(-1)
try {
	$app.ActiveWindow.ViewType = 9
	# Read the tile names from the dropped-down gallery.
	$probe = $pres.Slides.Add(1, 12).Shapes.AddPicture($png, 0, -1, 100, 100, 240, 180)
	$probe.Select()
	$desktop = Open-Gallery $app
	$popupItems = $desktop.FindAll($T::Descendants,
		(New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, $CT::ListItem)))
	$names = @()
	foreach ($item in $popupItems) {
		$n = $item.Current.Name
		if ($n -and $names -notcontains $n -and $n -match '(Frame|Bevel|Shadow|Rectangle|Oval|Perspective|Rotated|Edge|Matte|Metal|Reflected|Diagonal|Corner)') { $names += $n }
	}
	$script:gallery.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Collapse()
	$app.ActiveWindow.Selection.Unselect()
	$names | Set-Content -Encoding utf8 (Join-Path $root 'picture-styles.txt')
	$pres.Slides(1).Delete()

	for ($i = 0; $i -lt $names.Count; $i++) {
		$slide = $pres.Slides.Add($i + 1, 12)
		$pic = $slide.Shapes.AddPicture($png, 0, -1, 100, 100, 240, 180)
		$pic.Name = "style-$($i + 1)"
		$app.ActiveWindow.View.GotoSlide($i + 1)
		$pic.Select()
		$desktop = Open-Gallery $app
		$tile = Find-Element $desktop $names[$i] $CT::ListItem $null
		try {
			$tile.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
		} catch {
			$tile.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select()
		}
		Start-Sleep -Milliseconds 600
		"$($i + 1) $($names[$i])"
	}
	$pres.SaveAs((Join-Path $root 'picture-styles.pptx'))
} finally {
	$pres.Saved = -1
	$pres.Close()
	$app.Quit()
}
