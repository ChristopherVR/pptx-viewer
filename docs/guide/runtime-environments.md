---
title: Runtime Environments
description: Where pptx-viewer runs (browser, Node.js, Web Worker) and platform-specific behaviour that follows from running inside a browser sandbox.
---

# Runtime environments

`pptx-viewer` splits into a DOM-free core engine and browser-only UI bindings. This page covers where each part runs, and behaviour that follows directly from the browser sandbox rather than from a missing feature.

## Where it runs

| Environment              | Works     | Caveats                                                                                                                                                                              |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser                  | Yes       | The full feature set: parsing, rendering, editing, export, collaboration.                                                                                                            |
| Node.js (and serverless) | Core only | `pptx-viewer-core` (load, edit, save, Markdown/SVG conversion, encryption) is DOM-free. The UI bindings, raster export (`html2canvas`), and EMF/WMF conversion are browser features. |
| Web Worker               | Core only | Same scope as Node.js: the engine has no DOM dependency.                                                                                                                             |

## Platform notes

These are not gaps to be closed: they follow directly from running inside a browser's security sandbox, which cannot do what the desktop application can.

### Fonts

A browser has no font catalogue of its own to draw on the way the desktop app does, so `pptx-viewer` resolves each deck font in three steps: use it as-is when the reader's machine has it installed, otherwise fetch its verified metric-compatible clone from Google Fonts before layout (Calibri -> Carlito, Cambria -> Caladea, Arial -> Arimo, Times New Roman -> Tinos, Courier New -> Cousine, Georgia -> Gelasio, so line breaks and text extents still match PowerPoint), and only when neither exists fall back through PANOSE classification to a same-class generic font, which can shift metrics.

### Run program actions (`ppaction://program`)

PowerPoint's "Run program" action setting is parsed and round-tripped losslessly (the authored program path/command survives load and save unchanged), and the Action Settings dialog lets you view and edit it like any other action while editing. What a browser cannot do is what PowerPoint itself does when the action fires during a show: launch a local executable. No web platform API exists for that, by design (a page that could launch arbitrary local programs would be a critical security hole).

Instead, clicking a Run-Program shape during a running show shows a non-blocking notice naming the exact resolved command (the path and whatever arguments the author typed - OOXML stores them as one opaque string, there is nothing to split) with a one-click Copy button, so the presenter can see what PowerPoint would have run and launch it themselves outside the browser if they choose. The click still counts as handled (the show does not also advance), matching every other action type. Implemented once as a shared decision function (`packages/shared/src/render/presentation-action.ts`'s `runProgram` intent, plus `packages/shared/src/render/run-program-notice.ts`), consumed identically by all five bindings, with `e2e/run-program-notice.spec.ts` exercising the notice, the Copy button, and click-consumption against all five demos.

Two real bugs surfaced and were fixed while building this: React initially rendered the notice as a sibling of the element the running show calls `requestFullscreen()` on, and a real OS-level fullscreen element's top layer paints above everything outside it regardless of CSS `z-index`, so the Copy button was visible but not clickable; it now renders through the show stage's own overlay slot, alongside the other show-only chrome. Separately, a target string that is not URI-shaped (a typed path like `notepad.exe C:\temp\notes.txt`) was not being recognised as an external relationship target on save, so the written package failed `TargetMode="External"` validation for `ppaction://program`, `hlinkfile`, and `hlinkpres` alike; the save path now forces `External` for all three.

### Media playback

Audio and video playback depends on the browser's own codec support: WMV and other legacy codecs may not play, and DRM-protected media will not play. This is a platform fact, not a missing feature: `pptx-viewer` hands playback to the browser's native media element, and a browser only decodes what it ships a codec for.

## Related reading

- [Limitations](/guide/limitations) - open, unresolved gaps.
- [Visual Effect Fidelity](/guide/visual-effects) - CSS/SVG effect approximations and the evidence behind them.
