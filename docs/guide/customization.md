# UI Customization

## Reference

<!-- customization-reference:start -->

### Ribbon tabs (`ribbon.hiddenTabs`)

| Id            | Tab         |
| ------------- | ----------- |
| `file`        | File        |
| `home`        | Home        |
| `insert`      | Insert      |
| `draw`        | Draw        |
| `design`      | Design      |
| `transitions` | Transitions |
| `animations`  | Animations  |
| `slideShow`   | Slide Show  |
| `record`      | Record      |
| `review`      | Review      |
| `view`        | View        |
| `help`        | Help        |

### Toolbar buttons (`ribbon.hiddenButtons`)

| Id           | What it removes                                                 |
| ------------ | --------------------------------------------------------------- |
| `share`      | Share / collaboration button in the tab row and mobile toolbar. |
| `broadcast`  | Broadcast (present online) button.                              |
| `export`     | Export button and the File > Export page.                       |
| `undo`       | Undo button in the quick-access strip.                          |
| `redo`       | Redo button in the quick-access strip.                          |
| `record`     | Record button and the Record ribbon tab.                        |
| `notes`      | Notes toggle in the status bar.                                 |
| `fullscreen` | Full-screen toggle.                                             |
| `zoom`       | The zoom cluster (zoom in, zoom out, fit).                      |
| `navigation` | The previous / next slide cluster.                              |

### Options pages (`options.hiddenPages`)

| Id              | Page                 |
| --------------- | -------------------- |
| `general`       | General              |
| `proofing`      | Proofing             |
| `save`          | Save                 |
| `language`      | Language             |
| `accessibility` | Accessibility        |
| `advanced`      | Advanced             |
| `ribbon`        | Customize Ribbon     |
| `quickAccess`   | Quick Access Toolbar |
| `addIns`        | Add-ins              |
| `trust`         | Trust Center         |
| `ai`            | AI                   |

### Options sections (`options.hiddenSections`)

| Id                               | Section                                 |
| -------------------------------- | --------------------------------------- |
| `general.userInterface`          | User Interface options                  |
| `general.personalize`            | Personalize your copy of the viewer     |
| `general.appearance`             | Viewer theme                            |
| `general.fonts`                  | Fonts                                   |
| `general.startup`                | Start up options                        |
| `proofing.autoCorrect`           | AutoCorrect options                     |
| `proofing.spellingOffice`        | When correcting spelling                |
| `proofing.spellingViewer`        | When correcting spelling in the viewer  |
| `save.savePresentations`         | Save presentations                      |
| `save.cache`                     | Cache Settings                          |
| `accessibility.assistant`        | Make your document accessible to others |
| `accessibility.feedback`         | Feedback options                        |
| `accessibility.display`          | Application display options             |
| `advanced.editing`               | Editing options                         |
| `advanced.cutCopyPaste`          | Cut, copy, and paste                    |
| `advanced.imageQuality`          | Image Size and Quality                  |
| `advanced.chart`                 | Chart                                   |
| `advanced.display`               | Display                                 |
| `advanced.slideShow`             | Slide Show                              |
| `advanced.print`                 | Print                                   |
| `ribbon.shortcutReference`       | Keyboard Shortcuts                      |
| `quickAccess.quickAccessOptions` | Quick Access Toolbar options            |
| `trust.trustSettings`            | Security settings                       |

### Settings (`options.hiddenSettings`, `options.locked`, `options.defaults`)

| Id                                           | Type    | Built-in default | Label                                                           |
| -------------------------------------------- | ------- | ---------------- | --------------------------------------------------------------- |
| `general.displayOptimization`                | string  | `'appearance'`   | When using multiple displays                                    |
| `general.showMiniToolbar`                    | boolean | `true`           | Show Mini Toolbar on selection                                  |
| `general.enableLivePreview`                  | boolean | `true`           | Enable Live Preview                                             |
| `general.collapseRibbonAutomatically`        | boolean | `false`          | Collapse the ribbon automatically                               |
| `general.collapseSearchByDefault`            | boolean | `false`          | Collapse the search box by default                              |
| `general.screenTipStyle`                     | string  | `'descriptions'` | ScreenTip style                                                 |
| `general.userName`                           | string  | `''`             | User name                                                       |
| `general.userInitials`                       | string  | `''`             | Initials                                                        |
| `general.showStartScreen`                    | boolean | `true`           | Show the Start screen when this application starts              |
| `general.enableCustomFontUpload`             | boolean | `false`          | Let me add font files to this session                           |
| `proofing.autoCorrectTwoInitialCapitals`     | boolean | `true`           | Correct TWo INitial CApitals                                    |
| `proofing.autoCorrectCapitalizeFirstLetter`  | boolean | `true`           | Capitalize first letter of sentences                            |
| `proofing.autoCorrectCapitalizeDayNames`     | boolean | `true`           | Capitalize names of days                                        |
| `proofing.autoCorrectSmartQuotes`            | boolean | `true`           | Replace straight quotes with smart quotes                       |
| `proofing.autoCorrectHyphensToDash`          | boolean | `true`           | Replace hyphens (--) with dash                                  |
| `proofing.autoCorrectFractions`              | boolean | `true`           | Replace fractions (1/2) with fraction characters (½)            |
| `proofing.autoCorrectOrdinals`               | boolean | `true`           | Replace ordinals (1st) with superscript                         |
| `proofing.ignoreUppercase`                   | boolean | `true`           | Ignore words in UPPERCASE                                       |
| `proofing.ignoreWordsWithNumbers`            | boolean | `true`           | Ignore words that contain numbers                               |
| `proofing.ignoreInternetAddresses`           | boolean | `true`           | Ignore Internet and file addresses                              |
| `proofing.flagRepeatedWords`                 | boolean | `true`           | Flag repeated words                                             |
| `proofing.checkSpellingAsYouType`            | boolean | `false`          | Check spelling as you type                                      |
| `proofing.hideSpellingErrors`                | boolean | `false`          | Hide spelling errors                                            |
| `save.autoSave`                              | boolean | `true`           | Save changes automatically (AutoSave)                           |
| `save.autoRecoverIntervalMinutes`            | number  | `2`              | Save AutoRecover information every                              |
| `save.keepLastAutoRecoveredVersion`          | boolean | `true`           | Keep the last AutoRecovered version if I close without saving   |
| `save.defaultExportFormat`                   | string  | `'pptx'`         | Save files in this format                                       |
| `save.cacheRetentionDays`                    | number  | `14`             | Days to keep files in the local document cache                  |
| `save.clearCacheOnClose`                     | boolean | `false`          | Delete files from the local document cache when they are closed |
| `accessibility.showAccessibilityStatus`      | boolean | `true`           | Show accessibility status in the status bar                     |
| `accessibility.feedbackWithSound`            | boolean | `false`          | Provide feedback with sound                                     |
| `accessibility.soundScheme`                  | string  | `'modern'`       | Sound Scheme                                                    |
| `accessibility.showShortcutKeysInScreenTips` | boolean | `true`           | Show shortcut keys in ScreenTips                                |
| `accessibility.reducedMotion`                | boolean | `false`          | Reduced motion                                                  |
| `advanced.autoSelectEntireWord`              | boolean | `true`           | When selecting, automatically select entire word                |
| `advanced.allowTextDragAndDrop`              | boolean | `true`           | Allow text to be dragged and dropped                            |
| `advanced.maximumUndoSteps`                  | number  | `100`            | Maximum number of undos                                         |
| `advanced.useSmartCutAndPaste`               | boolean | `true`           | Use smart cut and paste                                         |
| `advanced.showPasteOptionsButton`            | boolean | `true`           | Show Paste Options button when content is pasted                |
| `advanced.imageDefaultResolution`            | string  | `'highFidelity'` | Default resolution                                              |
| `advanced.doNotCompressImages`               | boolean | `false`          | Do not compress images in file                                  |
| `advanced.chartPropertiesFollowDataPoint`    | boolean | `true`           | Properties follow chart data point                              |
| `advanced.recentPresentationsCount`          | number  | `50`             | Show this number of Recent Presentations                        |
| `advanced.showVerticalRuler`                 | boolean | `false`          | Show rulers                                                     |
| `advanced.showGrid`                          | boolean | `false`          | Show grid                                                       |
| `advanced.snapToGrid`                        | boolean | `false`          | Snap to grid                                                    |
| `advanced.disableHardwareAcceleration`       | boolean | `false`          | Disable hardware graphics acceleration                          |
| `advanced.disable3DRendering`                | boolean | `false`          | Disable 3D rendering (for performance)                          |
| `advanced.pixelateMosaicAnimation`           | boolean | `false`          | Show a mosaic effect for Pixelate transitions                   |
| `advanced.openDocumentsView`                 | string  | `'savedView'`    | Open all documents using this view                              |
| `advanced.slideShowShowMenuOnRightClick`     | boolean | `true`           | Show menu on right mouse click                                  |
| `advanced.slideShowShowPopupToolbar`         | boolean | `true`           | Show popup toolbar                                              |
| `advanced.slideShowPromptKeepInkAnnotations` | boolean | `true`           | Prompt to keep ink annotations when exiting                     |
| `advanced.slideShowEndWithBlackSlide`        | boolean | `true`           | End with black slide                                            |
| `advanced.printInBackground`                 | boolean | `true`           | Print in background                                             |
| `advanced.printHighQuality`                  | boolean | `false`          | High quality                                                    |
| `advanced.printUseMostRecentSettings`        | boolean | `true`           | Use the most recently used print settings                       |
| `advanced.printWhat`                         | string  | `'slides'`       | Print what                                                      |
| `advanced.printColorMode`                    | string  | `'color'`        | Color/grayscale                                                 |
| `advanced.printHiddenSlides`                 | boolean | `false`          | Print hidden slides                                             |
| `advanced.printScaleToFit`                   | boolean | `false`          | Scale to fit paper                                              |
| `advanced.printFrameSlides`                  | boolean | `false`          | Frame slides                                                    |
| `quickAccess.visible`                        | boolean | `true`           | Show Quick Access Toolbar                                       |
| `quickAccess.position`                       | string  | `'above'`        | Toolbar Position                                                |
| `quickAccess.showCommandLabels`              | boolean | `false`          | Always show command labels                                      |
| `trust.openInProtectedView`                  | boolean | `false`          | Open presentations in Protected View                            |
| `trust.allowExternalContent`                 | boolean | `true`           | Allow external content (remote images and media)                |
| `trust.confirmExternalHyperlinks`            | boolean | `true`           | Confirm before opening external hyperlinks                      |

### File tab pages (`backstage.hiddenPages`)

| Id        | Page    |
| --------- | ------- |
| `home`    | Home    |
| `new`     | New     |
| `open`    | Open    |
| `info`    | Info    |
| `save`    | Save    |
| `saveAs`  | Save As |
| `print`   | Print   |
| `share`   | Share   |
| `export`  | Export  |
| `close`   | Close   |
| `account` | Account |
| `options` | Options |

### File tab cards (`backstage.hiddenCards`)

| Id               | Card                            |
| ---------------- | ------------------------------- |
| `protect`        | Protect Presentation            |
| `inspect`        | Inspect Presentation            |
| `embedFonts`     | Embed Fonts                     |
| `signatures`     | Digital Signatures              |
| `versionHistory` | Version History                 |
| `saveAsPptx`     | PowerPoint Presentation         |
| `saveAsPpsx`     | PowerPoint Show                 |
| `saveAsPptm`     | Macro-Enabled Presentation      |
| `saveAsPpt`      | PowerPoint 97-2003 Presentation |
| `pdf`            | Create PDF                      |
| `png`            | Export current slide            |
| `video`          | Create a Video                  |
| `gif`            | Create an Animated GIF          |
| `json`           | Export as JSON                  |
| `copyImage`      | Copy as Image                   |
| `print`          | Print Presentation              |
| `share`          | Share with People               |

### Element context menu (`contextMenu.hiddenElementCommands`)

| Id                       | Entry                |
| ------------------------ | -------------------- |
| `copy`                   | Copy                 |
| `cut`                    | Cut                  |
| `paste`                  | Paste                |
| `duplicate`              | Duplicate            |
| `edit-text`              | Edit Text            |
| `bring-forward`          | Bring Forward        |
| `send-backward`          | Send Backward        |
| `bring-front`            | Bring to Front       |
| `send-back`              | Send to Back         |
| `ai-ask`                 | Ask AI about this    |
| `ai-fix`                 | Fix with AI          |
| `comment`                | Add Comment          |
| `hyperlink`              | Edit Hyperlink       |
| `table-insert-row-above` | Insert Row Above     |
| `table-insert-row-below` | Insert Row Below     |
| `table-delete-row`       | Delete Row           |
| `table-insert-col-left`  | Insert Column Left   |
| `table-insert-col-right` | Insert Column Right  |
| `table-delete-col`       | Delete Column        |
| `table-merge-selected`   | Merge Selected Cells |
| `table-merge-right`      | Merge Right          |
| `table-merge-down`       | Merge down           |
| `table-split`            | Split Cell           |
| `group`                  | Group                |
| `ungroup`                | Ungroup              |
| `save-as-picture`        | Save as Picture...   |
| `edit-alt-text`          | Edit Alt Text...     |
| `size-and-position`      | Size and Position... |
| `format-shape`           | Format Shape...      |
| `delete`                 | Delete               |

### Empty-canvas context menu (`contextMenu.hiddenCanvasCommands`)

| Id                  | Entry                |
| ------------------- | -------------------- |
| `paste`             | Paste                |
| `layout`            | Layout               |
| `reset-slide`       | Reset Slide          |
| `format-background` | Format Background... |
| `grid-and-guides`   | Grid and Guides      |
| `ruler`             | Ruler                |

### Editor shortcuts (`keyboard.disabled`, `keyboard.remap`)

| Id                   | Command                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `undo`               | Undo (Ctrl/Cmd+Z).                                                     |
| `redo`               | Redo (Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z).                                   |
| `copy`               | Copy the selection (Ctrl/Cmd+C).                                       |
| `cut`                | Cut the selection (Ctrl/Cmd+X).                                        |
| `paste`              | Paste (Ctrl/Cmd+V).                                                    |
| `duplicate`          | Duplicate the selection (Ctrl/Cmd+D).                                  |
| `delete`             | Delete the selection (Delete, Backspace).                              |
| `selectAll`          | Select every element on the slide (Ctrl/Cmd+A).                        |
| `group`              | Group the selection (Ctrl/Cmd+G).                                      |
| `ungroup`            | Ungroup (Ctrl/Cmd+Shift+G).                                            |
| `nudge`              | Move the selection with the arrow keys (disable only; not remappable). |
| `prevSlide`          | Previous slide (ArrowLeft with nothing selected).                      |
| `nextSlide`          | Next slide (ArrowRight with nothing selected).                         |
| `escape`             | Escape: leave the current mode (disable only; not remappable).         |
| `find`               | Find (Ctrl/Cmd+F).                                                     |
| `findReplace`        | Find and replace (Ctrl/Cmd+H).                                         |
| `toggleShortcuts`    | Keyboard-shortcut reference (?, Ctrl/Cmd+/).                           |
| `alignLeft`          | Align text left (Ctrl/Cmd+L).                                          |
| `alignCenter`        | Center text (Ctrl/Cmd+E).                                              |
| `alignRight`         | Align text right (Ctrl/Cmd+R).                                         |
| `alignJustify`       | Justify text (Ctrl/Cmd+J).                                             |
| `increaseFontSize`   | Increase font size (Ctrl/Cmd+Shift+>).                                 |
| `decreaseFontSize`   | Decrease font size (Ctrl/Cmd+Shift+<).                                 |
| `copyFormat`         | Copy formatting (Ctrl/Cmd+Shift+C).                                    |
| `pasteFormat`        | Paste formatting (Ctrl/Cmd+Shift+V).                                   |
| `newSlide`           | New slide (Ctrl/Cmd+M).                                                |
| `hyperlink`          | Insert or edit a hyperlink (Ctrl/Cmd+K).                               |
| `clearFormatting`    | Clear character formatting (Ctrl/Cmd+Space).                           |
| `cycleSelectionNext` | Select the next element (Tab).                                         |
| `cycleSelectionPrev` | Select the previous element (Shift+Tab).                               |
| `pasteSpecial`       | Paste Special (Ctrl/Cmd+Alt+V).                                        |

### Panels (`hiddenPanels`)

| Id                   | Region                                                               |
| -------------------- | -------------------------------------------------------------------- |
| `statusBar`          | The status bar under the canvas (slide counter, zoom, view buttons). |
| `slidesPane`         | The slide thumbnail rail on the left.                                |
| `inspector`          | The format / properties inspector on the right.                      |
| `notes`              | The speaker-notes panel under the canvas.                            |
| `quickAccessToolbar` | The quick-access strip in the title bar (save, undo, redo, ...).     |
| `titleBar`           | The title bar above the ribbon (file name, quick access, account).   |

### Features (`disabledFeatures`)

| Id              | What it switches off                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| `ai`            | The AI assistant: toolbar toggle, chat panel, AI context-menu entries, AI Options page. |
| `collaboration` | Real-time collaboration: Share and Broadcast buttons, dialogs and File pages.           |
| `comments`      | Commenting: the Add Comment context-menu entry.                                         |
| `presentMode`   | Slide-show entry points: the Slide Show ribbon tab.                                     |

### Dialogs (`hiddenDialogs`)

| Id          | What it removes                                                            |
| ----------- | -------------------------------------------------------------------------- |
| `options`   | File > Options (the Settings dialog) and the File tab entry that opens it. |
| `share`     | The Share dialog, its toolbar button, File > Share page and card.          |
| `broadcast` | The Broadcast dialog and its button.                                       |
| `print`     | The Print dialog, File > Print page and card.                              |
| `export`    | File > Export page, its cards and the Export button.                       |

### Export formats (`hiddenExportFormats`)

| Id          | Format                                               |
| ----------- | ---------------------------------------------------- |
| `pdf`       | Export to PDF.                                       |
| `png`       | Export the current slide as PNG.                     |
| `video`     | Export the deck as a video.                          |
| `gif`       | Export the deck as an animated GIF.                  |
| `json`      | Export the parsed deck as JSON.                      |
| `copyImage` | Copy the current slide to the clipboard as an image. |

<!-- customization-reference:end -->
