# Dialog footers (#396)

`before-<binding>-<dialog>.png` are the five dialogs that #342 captured while their
footers were still hand-built (Print, Document Properties, Hyperlink, Set Up Slide
Show, Custom Shows; copied from `../dialog-controls-after`). `after-<binding>-<dialog>.png`
are written by `e2e/dialog-footers-migration.spec.ts` with `UI_SHOTS_DIR` set, at
1440x900 on the sample deck, for the nine dialogs the spec opens. Equation, SmartArt,
Slide Templates, Share and Password Protection have no "before" capture because
no pre-change build was kept for them.
