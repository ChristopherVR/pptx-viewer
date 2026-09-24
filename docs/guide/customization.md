---
title: UI Customization
description: Hide, lock and remap any part of the viewer chrome from code - ribbon tabs and buttons, File > Options pages, sections and settings, the File tab, context menus, keyboard shortcuts, panels, features and dialogs - with one framework-neutral object that works the same in React, Vue, Angular, Svelte and Vanilla JS.
---

# UI Customization

Every binding renders the same PowerPoint-style chrome: a ribbon, a File tab,
a File > Options (Settings) dialog, right-click menus, a keyboard map, a slide
rail, an inspector, a status bar and a handful of dialogs. Most embeddings do
not need all of it. A kiosk wants no editing chrome at all; a corporate portal
wants the AI assistant gone and the author name pinned to the signed-in user; a
teaching tool wants a three-tab ribbon.

All of that is one object, `ViewerCustomization`, which you pass to the viewer
and can change at runtime:

```ts
import type { ViewerCustomization } from 'pptx-react-viewer'; // or vue / angular / svelte / vanilla

const customization: ViewerCustomization = {
	ribbon: { hiddenTabs: ['draw', 'record'], hiddenButtons: ['broadcast'] },
	options: {
		hiddenPages: ['trust', 'addIns'],
		locked: { 'general.userName': 'Ada Lovelace' },
		defaults: { 'advanced.showGrid': true },
	},
	contextMenu: { hiddenElementCommands: ['save-as-picture'] },
	keyboard: { disabled: ['newSlide'], remap: { duplicate: 'Mod+Shift+D' } },
	hiddenPanels: ['notes'],
	disabledFeatures: ['ai'],
	hiddenDialogs: ['broadcast'],
	hiddenExportFormats: ['video', 'gif'],
};
```

The object, its types, its id catalogues and the helper methods are identical
in all five bindings. The logic lives once in the internal shared package, so a
customisation that works in React works the same way in Svelte.

[[toc]]

## Concepts

### Hide, lock, default

There are three different things you can do to a setting in File > Options,
and they compose:

| You want                                             | Use                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| The user never sees the setting                      | `options.hiddenSettings: ['general.userInitials']`                  |
| The setting has a fixed value the user cannot change | `options.locked: { 'general.userName': 'Ada' }` (renders read-only) |
| Both: a fixed value and no control at all            | put the id in `locked` **and** `hiddenSettings`                     |
| A different starting value the user may still change | `options.defaults: { 'advanced.showGrid': true }`                   |

- A **locked** value is forced into the options store immediately and every
  later write to it is ignored, whichever path it comes from (the dialog, a
  ribbon toggle that writes the same option, Reset). The control renders
  disabled with the tooltip "This setting is managed by your organization".
  Locked values are never written to the user's saved preferences, so removing
  the lock gives the user back their own value.
- A **default** replaces the built-in default for users who have not saved a
  choice of their own, and becomes what Reset returns to. Host defaults are not
  persisted either: change the default in a later release and every user who
  never touched that setting follows it, while users who did keep their choice.

### Derived rules

Some ids switch off more than one entry point, so you do not have to list
every button that opens a dialog. These rules are applied once, in the shared
resolver:

- `hiddenDialogs: ['share']` removes the Share button, the File > Share page
  and the Share card. `['print']` removes File > Print and the Print card;
  `['export']` removes the Export button and File > Export; `['options']`
  removes File > Options.
- `disabledFeatures: ['collaboration']` hides the Share and Broadcast dialogs
  (and so all of the above for them).
- `disabledFeatures: ['ai']` removes the AI toggle and panel, the "Ask AI" /
  "Fix with AI" context-menu entries and the AI page of File > Options, even
  when the host passes an `ai` config.
- `disabledFeatures: ['comments']` removes the Add Comment context-menu entry.
- `disabledFeatures: ['presentMode']` removes the Slide Show ribbon tab and the
  F5 / Shift+F5 start-show shortcuts.
- `hiddenExportFormats` removes individual File > Export cards; hiding all six
  removes the Export button and page too.
- An Options section that loses every control is removed; an Options page that
  loses every section is removed. Menus repair their separators when the first
  entry of a group is hidden.

### Props and the imperative API

Pass the object as the `customization` prop (input, option) to set it up
front, and use the imperative helpers on the component handle to change it
while the viewer is running. Every change re-renders the affected chrome
immediately; nothing needs to be remounted.

- The **prop replaces**: when you give the viewer a new `customization`
  object, it becomes the whole customisation, discarding helper-method edits
  made since. Keep the object stable (memoise it, or keep it in state) unless
  you mean to replace it.
- The **helpers merge**: `hideRibbonTab('draw')` adds one id to what is there.
  `updateCustomization(patch)` merges one level deep (each section merges field
  by field; a list you pass replaces that list).

### Back-compat: `hiddenActions` and Customize Ribbon

The older `hiddenActions` prop keeps working. It is unioned with
`ribbon.hiddenTabs` and `ribbon.hiddenButtons`, so you can migrate at your own
pace. The user's own File > Options > Customize Ribbon choices are unioned on
top: a tab is shown only if neither the host nor the user hid it.

## The imperative API

Every binding exposes these methods on its component handle (React `ref`, Vue
template ref, Angular component instance, Svelte `bind:this`, Vanilla instance):

| Method                                                                  | Effect                                                                     |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `getCustomization()`                                                    | The current `ViewerCustomization` (a snapshot; do not mutate it).          |
| `setCustomization(c)`                                                   | Replace the whole customisation.                                           |
| `updateCustomization(patch)`                                            | Merge a partial customisation.                                             |
| `resetCustomization()`                                                  | Back to the stock UI.                                                      |
| `hideRibbonTab(id)` / `showRibbonTab(id)`                               | Toggle one ribbon tab.                                                     |
| `hideToolbarButton(id)` / `showToolbarButton(id)`                       | Toggle one toolbar button or control cluster.                              |
| `hideOptionsPage(id)` / `showOptionsPage(id)`                           | Toggle one File > Options page.                                            |
| `hideOptionsSection(id)` / `showOptionsSection(id)`                     | Toggle one section of an Options page.                                     |
| `hideSetting(id)` / `showSetting(id)`                                   | Toggle one setting.                                                        |
| `lockSetting(id, value, hidden?)`                                       | Pin a setting to `value`; `hidden: true` also removes its control.         |
| `unlockSetting(id)`                                                     | Remove a lock.                                                             |
| `setSettingDefault(id, value)`                                          | Set a host default (`undefined` clears it).                                |
| `hideBackstagePage(id)` / `showBackstagePage(id)`                       | Toggle one File tab page.                                                  |
| `hideBackstageCard(id)` / `showBackstageCard(id)`                       | Toggle one File tab action card.                                           |
| `hideContextMenuCommand(id)` / `showContextMenuCommand(id)`             | Toggle one element context-menu entry.                                     |
| `hideCanvasContextMenuCommand(id)` / `showCanvasContextMenuCommand(id)` | Toggle one empty-canvas context-menu entry.                                |
| `disableShortcut(id)` / `enableShortcut(id)`                            | Toggle one editor shortcut.                                                |
| `remapShortcut(id, chords)`                                             | Move a command onto new chord(s); `undefined` restores the built-in chord. |
| `setPanelVisible(id, visible)`                                          | Show or hide a chrome region.                                              |
| `setFeatureEnabled(id, enabled)`                                        | Switch a feature area on or off.                                           |
| `setDialogAvailable(id, available)`                                     | Allow or remove a dialog and its entry points.                             |

### Shortcut chords

A chord is `Modifier+Modifier+Key`: modifiers are `Mod` (Ctrl on Windows and
Linux, Cmd on macOS), `Ctrl`, `Meta`, `Alt` and `Shift`; the key is a
`KeyboardEvent.key` value such as `D`, `Delete`, `ArrowLeft` or `F2` (write
`Plus` for `+`). Letters match case-insensitively. A remapped command stops
answering to its built-in chord. Remapped chords keep every built-in guard:
they never fire in a read-only viewer, during a slide show, while the user is
typing in a text box, or (for selection commands) with nothing selected.
`nudge` and `escape` can be disabled but not remapped.

## Per-binding usage

::: code-group

```tsx [React]
import { useMemo, useRef } from 'react';
import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerHandle, ViewerCustomization } from 'pptx-react-viewer';

export function Deck({ bytes }: { bytes: Uint8Array }) {
	const viewer = useRef<PowerPointViewerHandle>(null);
	// Memoise: a new object each render would replace helper edits.
	const customization = useMemo<ViewerCustomization>(
		() => ({ ribbon: { hiddenTabs: ['draw'] }, disabledFeatures: ['ai'] }),
		[],
	);
	return (
		<>
			<button onClick={() => viewer.current?.hideRibbonTab('insert')}>Hide Insert</button>
			<PowerPointViewer ref={viewer} content={bytes} canEdit customization={customization} />
		</>
	);
}
```

```vue [Vue]
<script setup lang="ts">
import { ref } from 'vue';
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { PowerPointViewerExpose, ViewerCustomization } from 'pptx-vue-viewer';

defineProps<{ bytes: Uint8Array }>();
const viewer = ref<PowerPointViewerExpose | null>(null);
const customization: ViewerCustomization = {
	ribbon: { hiddenTabs: ['draw'] },
	disabledFeatures: ['ai'],
};
</script>

<template>
	<button @click="viewer?.hideRibbonTab('insert')">Hide Insert</button>
	<PowerPointViewer ref="viewer" :content="bytes" can-edit :customization="customization" />
</template>
```

```ts [Angular]
import { Component, viewChild } from '@angular/core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
import type { ViewerCustomization } from 'pptx-angular-viewer';

@Component({
	selector: 'app-deck',
	imports: [PowerPointViewerComponent],
	template: `
		<button (click)="viewer()?.hideRibbonTab('insert')">Hide Insert</button>
		<pptx-viewer #viewer [content]="bytes" [canEdit]="true" [customization]="customization" />
	`,
})
export class DeckComponent {
	bytes: Uint8Array | null = null;
	readonly viewer = viewChild<PowerPointViewerComponent>('viewer');
	readonly customization: ViewerCustomization = {
		ribbon: { hiddenTabs: ['draw'] },
		disabledFeatures: ['ai'],
	};
}
```

```svelte [Svelte]
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
	import type { ViewerCustomization } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let viewer: ReturnType<typeof PowerPointViewer> | undefined = $state();
	const customization: ViewerCustomization = {
		ribbon: { hiddenTabs: ['draw'] },
		disabledFeatures: ['ai'],
	};
</script>

<button onclick={() => viewer?.hideRibbonTab('insert')}>Hide Insert</button>
<PowerPointViewer bind:this={viewer} source={bytes} editable {customization} />
```

```ts [Vanilla]
import { createPptxViewer } from 'pptx-vanilla-viewer';
import type { ViewerCustomization } from 'pptx-vanilla-viewer';

const customization: ViewerCustomization = {
	ribbon: { hiddenTabs: ['draw'] },
	disabledFeatures: ['ai'],
};
const viewer = createPptxViewer(document.getElementById('deck')!, {
	source: bytes,
	editable: true,
	customization,
});

document.getElementById('hide-insert')!.addEventListener('click', () => {
	viewer.hideRibbonTab('insert');
});
```

:::

## Recipes

### Kiosk: a viewer with no editing chrome

Read-only already hides the editing commands; this also removes everything a
kiosk visitor could wander into.

```ts
const kiosk: ViewerCustomization = {
	ribbon: {
		hiddenTabs: [
			'file',
			'home',
			'insert',
			'draw',
			'design',
			'transitions',
			'animations',
			'record',
			'review',
			'view',
			'help',
		],
		hiddenButtons: ['share', 'broadcast', 'export', 'undo', 'redo', 'record'],
	},
	hiddenPanels: ['inspector', 'notes', 'quickAccessToolbar'],
	disabledFeatures: ['ai', 'collaboration', 'comments'],
	hiddenDialogs: ['options', 'print', 'export'],
	contextMenu: { disableElementMenu: true, disableCanvasMenu: true },
	keyboard: { disableAll: true },
};
```

Leave `slideShow` (and the `navigation` and `fullscreen` buttons) visible so
visitors can still present.

### Hide the Settings pages users do not need

```ts
const settings: ViewerCustomization = {
	options: {
		hiddenPages: ['proofing', 'addIns', 'trust', 'quickAccess', 'ribbon'],
		hiddenSections: ['general.startup', 'save.cache', 'advanced.print'],
		hiddenSettings: ['advanced.disableHardwareAcceleration'],
	},
};
```

To remove File > Options entirely, use `hiddenDialogs: ['options']`.

### Pin the user identity, locale and theme

The author name comes from the signed-in user and must not be edited:

```ts
viewer.lockSetting('general.userName', currentUser.displayName);
viewer.lockSetting('general.userInitials', currentUser.initials, true); // locked and hidden
```

Locale and theme are host props rather than Options settings. Pin them with
your binding's locale and theme props (`defaultLocale` / `locale`,
`theme` / `defaultThemeKey`, see the [Localization](/guide/localization) and
[Theming](/guide/theming) guides), then remove the pickers:

```ts
const pinned: ViewerCustomization = {
	options: {
		hiddenPages: ['language'], // the display-language picker
		hiddenSections: ['general.appearance'], // the viewer theme picker
	},
};
```

### Remove AI and collaboration

```ts
const noCloud: ViewerCustomization = { disabledFeatures: ['ai', 'collaboration'] };
```

With `ai` disabled the assistant stays off even if an `ai` config is passed,
which lets one build ship to tenants with and without the add-on:

```ts
viewer.setFeatureEnabled('ai', tenant.hasAiAddOn);
```

### Trim the ribbon to a minimal set

```ts
import { RIBBON_TAB_IDS } from 'pptx-react-viewer';

const keep = new Set(['file', 'home', 'insert']);
const minimal: ViewerCustomization = {
	ribbon: {
		hiddenTabs: RIBBON_TAB_IDS.filter((id) => !keep.has(id)),
		hiddenButtons: ['broadcast', 'record'],
	},
};
```

### Company shortcuts

```ts
const keys: ViewerCustomization = {
	keyboard: {
		disabled: ['newSlide', 'toggleShortcuts'],
		remap: { duplicate: 'Mod+Shift+D', group: ['Mod+G', 'Alt+G'] },
	},
};
```

### Build your own admin screen

Every id list is exported as a runtime array, alongside the types:
`RIBBON_TAB_IDS`, `TOOLBAR_BUTTON_IDS`, `OPTIONS_PAGE_IDS`,
`OPTIONS_SECTION_IDS`, `OPTIONS_SETTING_IDS`, `BACKSTAGE_PAGE_IDS`,
`BACKSTAGE_CARD_IDS`, `ELEMENT_CONTEXT_MENU_COMMAND_IDS`,
`CANVAS_CONTEXT_MENU_COMMAND_IDS`, `EDITOR_SHORTCUT_ACTION_IDS`,
`VIEWER_PANEL_IDS`, `VIEWER_FEATURE_IDS`, `VIEWER_DIALOG_IDS` and
`VIEWER_EXPORT_FORMAT_IDS`. Render checkboxes from them, store the resulting
object per tenant, and feed it back through `setCustomization`.

## What is not customisable yet

- **Individual ribbon groups and controls inside a tab.** Tabs and the
  top-level toolbar buttons are customisable; the groups inside a tab (Home >
  Font, Insert > Media, ...) are hand-built per binding and have no shared id
  catalogue yet, so they cannot be addressed without the bindings drifting.
- **The slide-show, slide-sorter and presenter keymaps.** `keyboard` covers the
  editor keymap. The only show key it affects is F5 / Shift+F5, through the
  `presentMode` feature.
- **The keyboard-shortcut reference** (the `?` overlay and Options > Customize
  Ribbon > Keyboard Shortcuts) lists the built-in chords, not your remaps. Hide
  it with `keyboard.disabled: ['toggleShortcuts']` and
  `options.hiddenSections: ['ribbon.shortcutReference']` if that matters.
- **Inspector sections** and the slide rail's own context menu are not
  addressable individually; hide the whole region with `hiddenPanels`.
- **Mobile layouts** honour ribbon, menu, dialog and feature customisation,
  but the mobile bottom sheets have no panel ids of their own.

## Reference

Generated from the shared id catalogues (`bun run docs:customization`); a
unit test fails if an id is missing here.

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
