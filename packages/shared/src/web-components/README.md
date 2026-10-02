# Shared Web Controls

`pptx-viewer-shared` registers these custom elements once in a browser. React,
Vue, Angular, Svelte, and Vanilla use the same implementation and the existing
viewer CSS variables for their colors.

Each control keeps readable scoped CSS in a sibling styles module. Browser
instances in the same document reuse a constructed stylesheet; DOMs without
that API receive a local `<style>` element. The document-level host rules
account for the viewer's Tailwind reset.

| Element            | Public properties and attributes                                                                          | Events            |
| ------------------ | --------------------------------------------------------------------------------------------------------- | ----------------- |
| `pptx-ui-search`   | `value`, `placeholder`, `disabled`, `aria-label`, `variant="titlebar"`                                    | `input`, `change` |
| `pptx-ui-select`   | `value`, `disabled`, `selectedIndex`, `options`, `aria-label`; child `<option>` and `<optgroup>` elements | `input`, `change` |
| `pptx-ui-checkbox` | `checked`, `disabled`, `value`, `aria-label`                                                              | `input`, `change` |

`input` and `change` bubble from the host. Read the current value or checked
state from `event.currentTarget`. Setting a property does not emit an event.
Select and checkbox participate in forms through `ElementInternals` where
supported; search exposes its underlying input in an open shadow root.

Select keeps the popup below the trigger, supports arrows, Home, End,
PageUp and PageDown (eight options per page, clamped to the nearest enabled
choice), typeahead, Enter, Space, and Escape, and skips disabled choices.
Every dialog and panel select and checkbox in the five bindings is one of
these two elements; `native-controls.test.ts` fails when a binding source
renders a native `<select>` or `<input type="checkbox">` outside its listed
exceptions. Checkbox
supports pointer and Space activation. Labels can wrap form-associated
controls, and each use also provides an explicit accessible name.

The migration covers File recent search, title-bar search, File > Options
rows, and select and checkbox controls throughout the Properties inspector.
Controls outside these surfaces remain for later batches.

`pptx-ui-slide-show-options` is the first shared ribbon family. It composes
the existing checkbox primitive into two columns and accepts structured DOM
properties `presentationProperties` (default undefined) and `labels` (a partial
map keyed by `SlideShowOptionId`, defaulting to translation keys), plus a boolean
`disabled` property/attribute (default false). Unsupported options stay disabled
and unchecked. The default slot holds host-owned caption commands.

User activation emits one bubbling, composed `show-options-change` event with
a `Partial<PptxPresentationProperties>` patch. State is controlled: an edit is
reflected only when the host supplies new properties, and programmatic updates
emit no event. Document mutation, history and persistence remain host-owned.
Checkbox names, Space activation, focus rings and forced colors come from the
shared checkbox. Labels activate the checkbox; disabled controls leave the tab
order. Labels use the shared theme tokens and expand to 44px rows on touch.

React uses a ref and native event listener for React 18 compatibility. Vue uses
DOM property bindings and a native event listener; Angular uses schema-enabled
property bindings; Svelte uses custom-element properties and its native event
handler; Vanilla assigns the same properties directly and resyncs after edits.
Registration is document-global and reuses compatible definitions. See the
registration contract below for mixed-version limits.

The Slide Show tab also pilots three reusable ribbon controls:

| Element                  | Attributes                                                                                                          | User intent                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `pptx-ui-ribbon-command` | Required `data-ribbon-control` and `label`; `icon`, `title`, `compact`, `disabled`, `active`, `pressed`, `expanded` | `command-request`: `{ id: RibbonControlId }`                  |
| `pptx-ui-ribbon-group`   | `label`, optional `data-ribbon-group`; default content slot                                                         | None                                                          |
| `pptx-ui-ribbon-toggle`  | Required `data-ribbon-control` and `label`; `checked`, `disabled`, `title`                                          | `toggle-request`: `{ id: RibbonControlId, checked: boolean }` |

Boolean attributes default to absent/false. `pressed` and `expanded` are optional
string booleans: omit them for ordinary commands. They reflect onto the native
button's ARIA attributes. The command's open shadow root exposes `part="button"`.
Icons come from shared trusted paths. Group captions and command sizing share the
existing theme tokens; compact commands and toggle rows expand on touch.

## Status bar (non-ribbon, #386)

`pptx-ui-status-bar` is the first non-ribbon family. It differs from a ribbon
command because it owns a whole row of live readouts and three gated clusters.

| Property or slot | Type and default                 | Meaning                                                                                                              |
| ---------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `state`          | `StatusBarViewState`, empty deck | Structured DOM property, never an attribute. Replace the object after updates.                                       |
| `collaboration`  | named slot                       | Host connection indicator, between the view buttons and zoom. The separator appears only while the slot has content. |

`StatusBarViewState` fields: `slideCount`, zero-based `activeSlideIndex` (clamped
for display), already-translated `saveText` with `saveKind` (`idle`, `saving`,
`error`), `zoomPercent` (omit to drop the zoom cluster), `showNotes` and
`notesExpanded`, `showViewModes`, `showSorter` and `showSlideShow` (default true),
`viewMode` (`normal`, `sorter` or `slideShow`, the pressed view button) and
`translate`. Use `resolveStatusBarSave` for the save text and `statusBarViewMode`
for the pressed view. The Notes, Normal, Sorter and Slide Show buttons expose
`aria-pressed`; every button has an `aria-label` and a title; the percent readout
is named by "Zoom to fit". The shadow root exposes `part="bar"`.

User activation emits one bubbling, composed `status-request` event with
`detail: { id }` where `id` is `notes`, `normal`, `sorter`, `slideShow`,
`zoomOut`, `zoomFit` or `zoomIn`. State is controlled; programmatic updates emit
nothing. Enter and Space stay inside the control. Buttons are 24px minimum and
44px on coarse pointers, the row keeps the 29px minimum height, language and save
text hide up to 767px, and forced colors use system colors. Every binding wraps
it in a thin adapter (React ref and native listener, Vue `.prop` and event
directive, Angular schema-enabled bindings, Svelte `onstatus-request`, Vanilla
direct property and listener). Notes, view switching, presentation and zoom stay
native.

Requests bubble and are composed; programmatic attribute changes never emit
requests. Toggle state remains controlled until the host commits it. Commands
use native button focus, Enter, Space and disabled behavior. Both the group and
its slotted controls retain light-DOM customization ids. Each adapter preserves
its existing dialog, document-edit and popup lifecycle. `SLIDE_SHOW_COMMAND_GROUPS`
owns labels, tooltips, order, icons and unsupported-command metadata in shared
render code. Other ribbon tabs continue using their current views until migrated.

## Notes toolbar (non-ribbon, #395)

`pptx-ui-notes-toolbar` is the formatting row above the speaker-notes editor. It
differs from a ribbon command because it owns one `role="toolbar"` with roving
focus, an editor-dependent enabled state and an in-element hyperlink form.

| Property | Type and default                                          | Meaning                                                                        |
| -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `state`  | `NotesToolbarViewState`, rich, formatting on, Print shown | Structured DOM property, never an attribute. Replace the object after updates. |

`NotesToolbarViewState` fields: `rich` (the active surface, drives the editor
switch label), `canFormat` (enables the formatting and link buttons; false in
the plain editor), `showPrint`, `disabled` (every button, for example with no
slide) and `translate` (the host translator; the canonical keys are
`pptx.notes.bold`, `italic`, `underline`, `strikethrough`, `bulletList`,
`numberedList`, `indent`, `outdent`, `insertLink`, `printNotes`, `plainEditor`,
`richEditor`, `switchToPlainEditor`, `switchToRichEditor`, `linkUrl`,
`linkDisplayText`, plus `pptx.notesToolbar.ariaLabel` and `pptx.common.cancel`).

User activation emits one bubbling, composed `notes-request` event
(`NotesToolbarRequestEvent`) whose `detail` is a `NotesToolbarIntent`:

| `kind`        | Extra fields                                      | Emitted by                                                |
| ------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `inline`      | `command`: bold, italic, underline, strikeThrough | The four character buttons                                |
| `paragraph`   | `command`: bullet, numbered, indent, outdent      | The list and indent buttons                               |
| `link`        | `url` (normalised, `https://` added), `text`      | Submitting the link form, after the selection is restored |
| `print`       |                                                   | Print notes                                               |
| `toggle-rich` |                                                   | The Plain editor / Rich editor button                     |

State is controlled and programmatic updates emit nothing. Buttons cancel
`mousedown` so the editor keeps its selection and focus; hosts should still
focus the editor before running a command so keyboard activation works. The
link form is a non-modal `dialog` positioned with `position: fixed` (above the
row when there is room), seeded with the selected text, closed by Escape, Cancel
or an outside press (Escape returns focus to the Insert link button) and refuses
an empty URL with `aria-invalid`. The row has a single tab stop; Left, Right,
Home and End move between enabled buttons and are kept from the viewer's
shortcuts, as are Enter, Space and every key typed in the form. Buttons are 28px
and 44px on coarse pointers; forced colors use system colors; the shadow root
exposes `part="bar"`. Editor, history, printing and collapse stay native in each
binding (React ref and listener, Vue `.prop` and event directive, Angular
schema-enabled binding, Svelte `onnotes-request`, Vanilla direct property and
listener).

## Title bar and quick access (#394)

`pptx-ui-title-bar` is the top chrome row: app mark, AutoSave switch, the Quick
Access strip (Save, Undo, Redo and the configured extras), file name and save
status, and the centred command search. It is controlled like the status bar.

| Property, attribute or slot | Type and default                    | Meaning                                                                                                                                                                        |
| --------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `state`                     | `TitleBarViewState`, nothing shown  | Structured DOM property, never an attribute. Replace the object after updates; `buildTitleBarState` maps the host values to it and owns the gating table and save-status rule. |
| `placement`                 | `titleBar` (default), `belowRibbon` | `belowRibbon` renders only the extras row for Options > Quick Access Toolbar > "Show below the Ribbon". It hides itself (`data-empty`) when there is nothing to show.          |
| `collaboration`, `account`  | named slots                         | Host-owned parts at the end of the row (presence indicator, account or AI button). The element never renders them itself.                                                      |

`TitleBarViewState` fields: `editing` and `searchVisible`, `fileName`, `autosave`
(`enabled`, `toggleAvailable`, translation key `statusKey`, `tone`), `history`
(`canUndo`, `canRedo`, `undoLabel`, `redoLabel`, `showUndo`, `showRedo`), `showSave`,
`quickAccess` (`visible`, `position`, `showCommandLabels`, `commandIds`), the search
`commands` (default: the shared catalogue), `contentSearch` (default true), a
`screenTip` function and `translate`.

Decisions that apply to every binding: the strip is Save, Undo, Redo (catalog
order, each gated by `showSave`, `showUndo`, `showRedo`) and then the other
configured commands in the order File > Options lists them; AutoSave, strip, status
and search appear only while `editing`; every strip button has `aria-label` = its
label and `title` = `screenTip(tooltip)`, where Undo and Redo name the pending
action when one is known. `resolveTitleBarStrip` is that ordering rule.

Events are bubbling, composed `CustomEvent`s and are never emitted for programmatic
updates: `toggle-autosave`, `save`, `undo`, `redo` (no detail), `quick-command`
(`{ id }`) and `command-search` (`{ query, command? }`; no `command` means "find
this text in the slides"). The switch is controlled: `aria-checked` follows
`autosave.enabled`. When `toggleAvailable` is false it is disabled and silent.

Keyboard and accessibility: the strip is a `role="toolbar"` named "Quick Access
Toolbar" with one tab stop and roving focus (Left and Right wrap, Home and End jump,
disabled buttons are skipped). Tab order is AutoSave, strip, search. Space, Enter,
arrows and plain typing stay inside the control and never reach slide shortcuts. The
search results are a listbox: Up and Down move, Enter commits, Escape clears. Buttons
are 24px and grow to 44px on coarse pointers, forced colors use system colors, and
the row hides below 768px (and on landscape phones) where the compact toolbar takes
over. The shadow root exposes `part="bar"`; the host carries `data-pptx-title-bar`
(`data-pptx-quick-access="below"` for the second placement).

## Registration and supported versions

The controls are internal viewer UI, not separately published custom elements.
Registration is explicit and browser-only. Importing the registration entry in
SSR creates no DOM, stylesheet or custom-element definitions; rendering on the
server emits hosts and light-DOM content only. Hydration must register controls
before applying structured properties or binding native events.

Multiple viewers and bundles in the same window share definitions and one host
stylesheet. Each newly registered constructor carries internal contract revision
1 under `Symbol.for('pptx-viewer.web-control-contract')`. Independently bundled
copies with the same revision reuse the first definition. A known different
revision throws before styles or definitions are installed, with the conflicting
tag in the error. Increment this revision for incompatible properties/events,
not for routine compatible styling changes or each package release.

Use matching released bindings in one window. Equal revisions establish ABI
compatibility, not identical styling: the first bundle's implementation wins.
Older unmarked definitions remain usable for the existing foundation controls,
but are never relabeled as compatible. Arbitrary mixed versions with unmarked
controls are unverified and unsupported. Separate windows have separate
registries; scoped registries and cross-document adoption are not supported.

## Properties, attributes and ownership

Boolean attributes use presence: `disabled="false"` is still disabled. Remove
the attribute or set its DOM property to false. Only `pressed`/`expanded` accept
string booleans. Unknown icons render no path; required labels and ids must be
supplied by the host. Structured objects are DOM properties, never JSON strings.
Replace presentation properties and label maps after updates rather than relying
on mutation of the same object to trigger a refresh.

| Family             | Default state                                                                                                    | Programmatic updates                                                                             | User events                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Search             | Empty value/placeholder, enabled; name falls back to placeholder or Search                                       | `value`, `disabled`; attributes placeholder, value, aria-label, disabled                         | Native `input` then `change` as the inner search input produces them; read host value                                             |
| Checkbox           | Unchecked, enabled, value `on`; host supplies accessible name                                                    | `checked`, `disabled`, `value` properties or attributes                                          | `input` then `change` after activation; read host checked                                                                         |
| Select             | First selected or eligible option, otherwise empty; enabled                                                      | `value`, `selectedIndex`, disabled; children define readonly options list                        | `input` then `change` only when a different eligible option is committed; read host value                                         |
| Slide Show options | Timings/narration enabled by default; unsupported options unchecked/disabled; labels default to translation keys | DOM `presentationProperties`, `labels`, disabled                                                 | One `show-options-change` with a presentation-property patch; host commits before display changes                                 |
| Ribbon command     | Enabled, ordinary size, inactive; no pressed/expanded state                                                      | Attributes label, icon, title, disabled, active, compact, pressed, expanded and customization id | One `command-request` with `{ id }`; host owns action                                                                             |
| Ribbon toggle      | Unchecked, enabled                                                                                               | Attributes label, title, checked, disabled and customization id                                  | One `toggle-request` with `{ id, checked }`; host commits before display changes                                                  |
| Ribbon group       | Empty label and content                                                                                          | Label and optional group id; default slot                                                        | None                                                                                                                              |
| Status bar         | Empty deck, no zoom cluster, notes hidden, no pressed view unless `viewMode` is set                              | DOM `state` (counter, save text, zoom, gating, pressed view), `collaboration` slot               | One `status-request` with `{ id }`; host owns every action                                                                        |
| Title bar          | Nothing editable, no strip, default file name                                                                    | DOM `state`, `placement` attribute, `collaboration` and `account` slots                          | One typed event per intent (`toggle-autosave`, `save`, `undo`, `redo`, `quick-command`, `command-search`); host owns every action |

All user events bubble and cross open shadow roots. Programmatic changes emit
no edits. Use `event.currentTarget` for native value events and `event.detail`
for intent events; `event.target` may be retargeted by shadow DOM. Do not wire
both host click and command-request to the same action. Native button Enter and
Space activation stays inside the command so viewer navigation cannot consume it.

## Adapter lifecycle

React 18/19 adapters assign structured properties through refs, use native
listeners for custom events and remove those listeners in effect cleanup.
StrictMode setup/cleanup and callback replacement must still produce one intent.
Vue binds structured properties with `.prop` and owns its event directives;
Angular uses schema-enabled property/event bindings and viewer-scoped services;
Svelte uses native custom-element properties/events; Vanilla owns DOM listeners
and resyncs presentation properties after edits. Framework-managed nodes are
discarded on unmount; never retain disposed nodes or callbacks in global caches.

Control-local listeners are installed once in constructors and survive a
supported disconnect/reconnect of the same node. Select disconnect closes its
popup, removes document/window listeners, disconnects its observer, cancels its
refresh frame and clears typeahead. Reconnecting rereads current attributes and
options. Host document mutation, history, persistence and popup/dialog lifecycle
remain in the adapter. Viewer instances must own separate state and callbacks.

## Checks required for each next migration

- Compare the same surface, values, disabled actions and layout in all five demos.
- Exercise pointer, Enter/Space, focus visibility, label activation and disabled
  tab order. Verify ARIA pressed/expanded/checked state and popup Escape/Tab rules.
- Remount one instance while another remains mounted; callbacks and model state
  must remain isolated, with no duplicate edits or stale callbacks.
- Check light/dark token inheritance, forced colors and a touch context. Compact
  commands and label rows need at least 44px height on coarse pointers/narrow UI.
- Keep customization ids on hosts. Use browser locators that traverse open shadow
  roots; a light-DOM-only inventory silently misses native controls.
- Verify SSR import, repeated registration and known incompatible ABI rejection.
  Never import a DOM constructor at module scope or redefine an existing tag.

`pptx-ui-subtitle-settings` owns a native dialog, its draft and keyboard focus.
The adapter supplies `settings`, translated `labels` and `languageDisabled` as
properties. Apply emits one composed `subtitle-settings-change` event containing
`{ spokenLanguage }`; Cancel and Escape discard the draft. Disconnect closes the
dialog. The viewer stores `accessibility.subtitleLanguage` in its options store,
which handles persistence and host locks. This preference is independent of the
Subtitles visibility flag and is not written into presentation metadata. `auto`
uses the browser language. Speech recognition receives the selected language;
this control does not provide translation or caption positioning.

The neutral `web-control-contract.spec.ts` covers token inheritance, focus,
forced colors, touch targets, reconnect and two independent control instances.
Adapter unit tests cover framework mount/remount and callback boundaries. The
Slide Show browser specs cover real viewer state surviving tab changes.

`pptx-ui-theme-editor` owns the theme draft, preset gallery, color/font fields,
preview and CSS. Properties are `theme`, translated `labels` and `disabled`.
`theme-editor-apply` emits one detached `{ name, colorScheme, fontScheme }`
payload; `theme-editor-close` dismisses without applying. Both events bubble
and cross the shadow boundary. Reset copies the current host theme. A host
refresh preserves a dirty draft, and unknown fonts and non-Latin font metadata
survive editing. The adapter commits the payload through its native document,
history and save path, then unmounts the editor on Apply or Close.

Design > Edit Theme docks against the shared editor body below the ribbon.
Below 768px it becomes a bottom sheet with scrollable fields and visible actions.
Opening focuses the name; Escape and Close return focus to the opener. The
optional `inline` attribute supports secondary inspector/gallery placement
without docking or automatic focus. Native adapters must discard dismissed
instances so reopening starts from the loaded theme. See
`e2e/theme-editor-migration.spec.ts` for the five-binding integration contract.

## Ribbon galleries and Design commands

`pptx-ui-ribbon-gallery` owns the trigger, inline previews, sections, tiles and
popup layout. Its `descriptor` property is the shared `RibbonGalleryDescriptor`;
`translateLabel` resolves keys, `disabled` gates every pick, and `open`/`close()`
control dismissal. Attributes are `mode="inline|dropdown"`, `chevron-only`, and
optional `icon`. `gallery-pick` bubbles and is composed with
`{ gallery, itemId }`; programmatic updates emit no intent. Native hosts build
shared descriptors and apply shared results through their existing document,
undo, theme and persistence callbacks.

Gallery content intentionally uses scoped light DOM to retain the established
`data-ribbon-gallery`, `data-ribbon-gallery-popup`, `data-gallery-item` and
customization selector contract. The shared stylesheet scopes every rule to the
host; it is installed once per document. This differs from the simpler ribbon
controls' shadow roots. Popup content attaches only while open. Escape restores
trigger focus, ArrowDown opens and focuses a choice, an outside pointer dismisses,
and descriptor refresh preserves the focused item's identity. Disconnect closes
and removes document listeners. Disabled or missing selection prevents opening.
Theme tokens, forced colors and 44px coarse-pointer targets are shared.

Design command and group metadata lives in `DESIGN_RIBBON_COMMANDS` and
`DESIGN_RIBBON_GROUPS`; `designCommandState` controls availability and open state.
Adapters retain native slide-size inspection, theme editing, preset selection and
format-background dialogs. Contextual groups use `CONTEXTUAL_TAB_GROUPS` and the
same shared group and gallery elements in every binding.

Shared gallery buttons carry `data-pptx-compact` to opt out of a native binding's
generic button size reset. Their own shared media rules retain 44px targets on
coarse pointers and narrow ribbon layouts.

## Command sections and Review

`pptx-ui-ribbon-section.groups` receives translated `RibbonGroupView` arrays.
The shared keyed renderer reuses the command and group primitives, preserves
focused buttons during controlled updates, owns compact stacks, and forwards
the existing composed `command-request` event. The host retains all callbacks;
setting the model never invokes one. Removing a group removes its commands, and
remounting retains the latest controlled model without adding listeners.

`buildReviewRibbon` owns the seven Review groups, labels, icons, disabled
placeholders, comment badge and controlled proofing/panel state. Language now
has the public ID `review.language.language`; Hide Ink belongs to `review.ink`.
Native adapters retain settings, comparison, spell-check preferences, comment
mutation/history and accessibility panels. The Angular-only duplicate Link
command is removed from Review; its native output remains compatible.

## Draw tools

`pptx-ui-ribbon-draw.state` is a controlled `RibbonDrawViewState`: tool, color,
width, editability, recent colors and a translation callback. The light-DOM
view keeps customization IDs effective, including the new additive
`draw.tools.freeform` ID. It owns all tool icons, pressed/disabled state,
standard/recent/custom color choices, width presets and the continuous slider.
The 16px preset previously available only in Vanilla is reachable in every
binding. Escape and outside pointer dismissal close the color popup; Escape
returns focus to its opener. Disconnect removes document/window listeners.

The composed `draw-request` event carries a `RibbonDrawIntent` discriminated
by `kind`: `tool`, `width` or `color`. A color intent marks whether the pick is
committed. Hosts apply live color previews immediately and record recent colors
only for committed picks. Setting state emits no intent. Native hosts retain
ink pointer capture, live stroke previews, freeform shape creation, erasing,
selection, undo/history and serialization. The shared view preserves focused
controls across updates, isolates instances and uses the common theme tokens,
forced colors and 44px coarse-pointer targets.

## View ribbon

`pptx-ui-ribbon-view.state` is a controlled `RibbonViewState`: editability,
the Rulers/Grid/Guides/Snap to Grid/Snap to Shape/template flags, optional
Selection Pane and Eyedropper active/availability, `zoomAvailable` and a
translation callback. The light-DOM view renders the five View groups with the
public customization ids; Handout Master, Notes Master, Zoom and Macros are
disabled placeholders. Both guide buttons live inside one
`view.show.addGuide` wrapper.

The composed `view-request` event carries a `RibbonViewIntent`: `command`
(normal, slideSorter, outline, readingView, slideMaster, selectionPane,
eyedropper, zoomToFit), `option` (with the requested boolean) or `guide` (h or
v). Edit-only commands (slideMaster, eyedropper, templateEditing) are rejected
while read-only. Setting state emits no intent and checkbox rows are restored to
the controlled value after each request. Native hosts retain persisted
viewer options, view switching, the browser EyeDropper, template editing and
history. Focus is preserved across updates and instances are isolated.

## Transitions ribbon

`pptx-ui-ribbon-transitions.state` is a controlled `RibbonTransitionsViewState`:
the `RibbonTransitionDraft` read from the active slide (`readRibbonTransitionDraft`),
that slide's raw `transition` (only used to list and select Sound entries),
editability, the Inspector pane's open state and a translation callback that
may take interpolation params (the preset title uses `{{name}}`). The light-DOM
view renders the Preview, Transition to This Slide and Timing groups with the
public customization ids (`transitions.preview.preview`,
`transitions.transitionToThisSlide.gallery`, `transitions.timing.sound`,
`duration`, `applyToAll`, `advanceOnClick`, `advanceAfter`); the Inspector
toggle is an id-less command after the groups, as before. It owns the nine
preset buttons (`aria-pressed` reflects the draft), the number and text
fields, the checkbox rows, the Sound select with its preview button and the
hidden audio file input. Presets are 28px tall, 44px on coarse pointers or
narrow viewports.

The composed `transitions-request` event carries a `RibbonTransitionsIntent`:
`preview`, `preset`, `duration` (seconds, clamped 0 to 20), `advanceOnClick`,
`advanceAfter`, `advanceAfterText`, `applyToAll`, `sound` (None or a stock
catalogue id), `soundFile` (a picked `File`), `soundPreview` and `inspector`.
Shared helpers turn intents into native work: `ribbonTransitionsDraftPatch`
(commit through `ribbonTransitionUpdates`), `ribbonTransitionsSoundChange`
(None, stock or file bytes as a `Partial<PptxSlideTransition>`) and
`ribbonTransitionStockSoundUrl`. All edit intents are rejected while
read-only; Preview, Inspector and sound preview are not edits. Choosing
"Other Sound..." opens the owned file input and restores the select.

Duration commits per `input` event; the After time commits on `change`
(blur or Enter) so half-typed `mm:ss.hh` text never becomes a history step.
Focused fields are not overwritten while typing, and a blur snaps a field back
to the model. Hosts keep slide mutation, history, persistence, the transition
preview replay (`playSlideTransitionPreview`, which needs the stage), audio
playback and the inspector pane. The Effect Options catalogue id has no
control in any binding yet, so none is rendered. Known boundary: the Vanilla
host does not track inspector open state, so its Inspector command is never
pressed, and Angular does not pass it either.

## Animations ribbon

`pptx-ui-ribbon-animations.state` is a controlled `RibbonAnimationsViewState`:
`editable`, `hasSelection`, optional `paneOpen` (the Animation Pane's pressed
state), optional `previewActive` (a transient Preview highlight, for hosts that
track one) and a translation callback. The light-DOM view renders the five
Animations groups (Preview, Animation, Motion Paths, Advanced Animation and
Timing) with the public customization ids, including the entrance/emphasis/exit
preset gallery and the five-family motion-path gallery. Every effect is a real
button; the galleries scroll instead of growing so the ribbon stays one row.
Exit Effects now carries `animations.advancedAnimation.addAnimation` in every
binding (it was untagged in React, Svelte and Vanilla); Path Animation has no
customization id in any binding.

The composed `animations-request` event carries a `RibbonAnimationsIntent`:
`add` (`group` is `entrance`, `emphasis`, `exit` or `motionPath`; `preset` is a
preset name, or a motion-path catalogue id for `motionPath`) or `command`
(`preview`, `effectOptions`, `animationPane`, `trigger`, `remove`). Intents are
rejected while read-only or without a selection, except the Animation Pane,
which stays reachable. Setting state emits no intent.

Native hosts retain every effect edit (adding, removing and ordering effects,
triggers, timing, direction, repeat), the play-order timeline and drag
reordering (Svelte and Vanilla), the Animation Pane/inspector lifecycle,
Preview playback, history and persistence. The Timing group's Start and
Duration fields and Animation Painter remain disabled placeholders in every
binding; per-effect timing is authored in the Animation Panel (and, in Svelte
and Vanilla, the timeline row), not from these fields. Effect Options and
Trigger open the Animation Panel in React, Vue, Svelte and Angular; Vanilla's
panel command is the inspector toggle.

## Insert ribbon

`pptx-ui-ribbon-insert.state` is a controlled `RibbonInsertState`: editability,
`hasSelection` (Link tracks the selection, not editability), the staged
`shapeType` and `chartKind`, the armed and visible Freeform tools, availability
flags (`chartAvailable`, `fieldAvailable`, `headerFooterAvailable`) and a
translation callback. The light-DOM view renders the seven Insert groups
(tables, images, illustrations, links, text, symbols, media) with the public
customization ids, in PowerPoint's group order. The Shape and Chart pickers are
a native select beside an insert button; Action and Field are click/keyboard
menus (Arrow keys, Escape and outside press dismiss; Escape returns focus to the
opener) that replace the former hover-only popups. Header & Footer is a compact
command in the text group without a catalogue id, so it cannot be customized
away by id (unchanged). `focusControl(id)` returns focus after a native dialog.

The composed `insert-request` event carries a `RibbonInsertIntent`: `command`
(textBox, table, image, media, smartArt, equation, link, headerFooter),
`shapeType`/`shape` (stage / insert), `chartType`/`chart`, `freeform` (a tool or
`null` to disarm), `actionButton` or `field` (slidenum, datetime, header,
footer). Intents are validated against the shared catalogues and rejected while
read-only (Link only needs a selection). Setting state emits no intent and
select values are restored to the controlled value after each request.

Native hosts retain every document mutation and its undo history, the file
pickers and FileReader/image-probe plumbing, the SmartArt gallery, equation
editor, hyperlink and Header & Footer dialogs, and the Date/Time format picker
(React, Vue and Angular open it for the `datetime` field; Svelte and Vanilla
insert the current date directly, as before). Freeform arming and the canvas
drawing overlay stay native. Focus is preserved across updates and instances are
isolated.

## Home ribbon

Home (#373) migrates in group families. Each family is a light-DOM element
`pptx-ui-ribbon-home-<family>` built from one declarative spec
(`RIBBON_HOME_FAMILIES`) in shared render code, so ids, labels, order and icons
cannot drift between bindings. Hosts assign `state`
(`RibbonHomeViewState`: a `controls` map of `{ disabled, pressed, hidden }` per
control id, plus an optional translator) and listen for the composed
`home-request` event whose `detail` is `{ id: RibbonControlId }`. Setting state
emits nothing; unknown, disabled and hidden ids are rejected. Controls are real
`<button data-ribbon-control>` elements, so public customization hides them
through the viewer's existing scoped styles. Pointer press keeps the slide text
selection (the mousedown default is prevented) and Space/Enter stay out of the
viewer's slide shortcuts. `pressed` is reflected as `aria-pressed` only when the
host supplies it. Targets grow to 44px on coarse pointers and narrow widths,
and forced colors outline the pressed state.

| Family      | Element                         | Controls                                                                                                                                       |
| ----------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `clipboard` | `pptx-ui-ribbon-home-clipboard` | The whole `home.clipboard` group: Paste, Cut, Copy, Format Painter                                                                             |
| `font`      | `pptx-ui-ribbon-home-font`      | The character strip inside `home.font`: Bold, Italic, Underline, Strikethrough, Text Shadow, Increase and Decrease Font Size, Clear Formatting |
| `paragraph` | `pptx-ui-ribbon-home-paragraph` | The indent and alignment strips inside `home.paragraph`: Decrease and Increase Indent, Align Left, Center, Align Right, Justify                |
| `editing`   | `pptx-ui-ribbon-home-editing`   | The Find and Replace strip inside `home.editing`                                                                                               |

`clipboardHomeControls` fixes the gating once: Paste needs edit rights and a
clipboard, Cut needs edit rights and a selection, Copy needs only a selection,
and the Format Painter needs edit rights plus a formattable selection but stays
enabled while armed so it can be cancelled. Hosts without a Format Painter hide
it with `hidden`. The painter button keeps `data-testid="format-painter-toggle"`
and mirrors its armed state in `data-active`. Native hosts retain every
clipboard action, history and persistence. The former React and Vue green
"copied/cut" flash was cosmetic, existed in two of five bindings, and is not
carried over.

`fontHomeControls` disables the whole strip unless a text selection is editable
and reflects `aria-pressed` for the four decorations and Text Shadow. Native
hosts keep how each edit is made: React reads the run-level tri-state at click
time, Angular and Svelte patch the element's text style, and Vanilla uses the
format mutations. The font family and size pickers, character spacing, change
case and the colour pickers are native or app-owned popovers and stay outside
the strip. Bindings still differ on the size ladder (React and Vue add 2pt,
Angular steps through the preset list), which is an existing editing difference
this change does not unify. The old React Font buttons stayed live for
non-text selections; they now disable like the other four bindings.

`paragraphHomeAction` decodes the indent and alignment ids (the shared
24-model-pixel indent step, or an alignment) and `paragraphHomeAlign` narrows a
stored alignment to the four values the strip can show; alignment is reflected
as `aria-pressed` only when the host can read an explicit alignment. The Bullets
and Numbering toggles keep their library galleries, and line spacing, text
direction and columns stay native selects, so they sit outside the strip.
Svelte keeps its own indent step (`adjustIndentPatch` by one level) because the
shared indent id only tells it which direction to go.

Find and Replace both open the host's find panel (the host owns that panel).
`editingHomeControls({ findOpen })` mirrors an open panel on both buttons when a
host can report it (Svelte does); other hosts omit it and show no pressed state.
The Select menu and its Select All command are app-owned popovers and stay
native.

### Slides, Drawing and Arrange

| Family          | Element                             | Controls                                                                                      |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `slides`        | `pptx-ui-ribbon-home-slides`        | The whole `home.slides` group: split New Slide, Slide Templates, Layout, Reset, Section       |
| `drawing`       | `pptx-ui-ribbon-home-drawing`       | The Shapes, Arrange, Shape Fill and Shape Outline triggers inside `home.drawing`              |
| `arrange-align` | `pptx-ui-ribbon-home-arrange-align` | The `home.arrange.align` wrapper: six Align edges plus Distribute Horizontally and Vertically |
| `arrange-flip`  | `pptx-ui-ribbon-home-arrange-flip`  | Flip Horizontal and Flip Vertical                                                             |
| `arrange-order` | `pptx-ui-ribbon-home-arrange-order` | Send Backward, Bring Forward, Send to Back, Bring to Front                                    |
| `arrange-edit`  | `pptx-ui-ribbon-home-arrange-edit`  | Duplicate and Delete                                                                          |

The intent is now `{ id, part? }`. `part` tells apart buttons that share one
public id: the New Slide caret (`caret`) and the Align strip (an edge such as
`centerH`, or `distribute-horizontal`/`distribute-vertical`; decode with
`arrangeAlignAction`). Such buttons are keyed `id#part` in `state.controls`.
Controls with visible text use it as their accessible name and keep the longer
phrase as the tooltip. Popover triggers (`popup`) and the New Slide split sit in
a `div.slot[data-ribbon-control]` wrapper, as the native split buttons and menu
hosts did, so customization hides trigger and popover together; the inner button
carries `aria-haspopup`, and `expanded` state reflects as `aria-expanded`.
`element.anchor(id)` returns the wrapper (or button) so the host can position or
mount its native popover.

Gating helpers: `slidesHomeControls` takes the host-specific rules that differ
between bindings (`newSlideNeedsLayout`, `resetNeedsSlide`, `showTemplates`),
`drawingHomeControls` (Shapes needs edit rights, the rest also a selection) and
`arrangeHomeControls` (edit rights plus a selection; Distribute uses the host's
own `canDistribute`).

Still native, and why: the layout galleries (New Slide caret and Layout), the
Shapes and Arrange menus, the Fill and Outline colour popovers and the Slide
Templates dialog are anchored, focus-managed popovers that read each binding's
deck data (layout previews, theme colours, recent colours) and run its undo
path, so only their triggers are shared. In Drawing the Quick Styles and Shape
Effects galleries are already the shared gallery element and the group wrapper
sits with them. Arrange keeps its second Format Painter pill, Group/Ungroup,
Merge Shapes, Crop and outline width (selects, spinners and menus tied to each
binding's selection state). In Font and Paragraph the family and size
selectors, character spacing, change case, font and highlight colour pickers,
Bullets and Numbering (with their library galleries), line spacing, text
direction, columns and the Select menu remain native for the same reason.

## Context menu

`pptx-ui-context-menu` draws every pointer-anchored context menu in all five
bindings: the element, empty-canvas, slide-thumbnail and slide-show menus (and
the Vanilla read-only AI menu). It is controlled and stateless about commands.

| Property | Type                    | Notes                                                                                                                               |
| -------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `state`  | `ContextMenuViewState`  | `x`, `y` (viewport pixels), `label`, `items`, optional `markers`, `zIndex`, `autoFocus`. Writing an equal state is a no-op.         |
| `items`  | `ContextMenuViewItem[]` | `id`, translated `label`, and optional `separatorBefore`, `heading`, `danger`, `disabled`, `checked` (a toggle: `menuitemcheckbox`) |

Events bubble and are composed: `menu-request` carries `{ id }` when a row is
activated; `menu-close` carries `{ reason: 'escape' | 'outside' | 'tab' }`. The
element never closes itself. The host runs the command and removes the element
(or clears `items`). Gating, entry lists, host customization commands and
editor handlers stay in each binding; `contextMenuViewItems`,
`slidePaneViewItems` and `presentationViewItems` map the shared entry lists to
rows, and `CONTEXT_MENU_PRESENTATION_LAYER` stacks a slide-show menu above every
binding's presentation overlay.

The host element carries the `data-pptx-*` test hooks named in `markers`
(`data-pptx-context-menu`, `data-pptx-canvas-context-menu`,
`data-pptx-slide-pane-context-menu`, `data-pptx-presentation-menu`); the
`role="menu"` surface and its rows are in the open shadow root. Rows are
`menuitem` or `menuitemcheckbox`, rules are `separator`, and headed sections are
`group`s. Opening focuses the first enabled row; ArrowUp/Down (wrapping), Home,
End and type-ahead move one roving tab stop and skip disabled rows; Enter and
Space activate. Escape (consumed, so a slide show behind it keeps running), a
press outside and Tab dismiss; the innermost of several open menus handles
Escape. On removal focus returns to the element focused at open unless a command
moved it. The menu clamps itself into the window, scrolls when taller than it,
grows rows to 44px on coarse pointers and uses system colors under forced
colors. There are no nested menus today: no binding has a submenu, so the model
has no submenu entries.

Eight small non-ribbon families share one element each. They differ from a ribbon
command because each owns a whole row or card (a banner with an inline password
form, a floating strip, a stack, a dialog action row, a phone bar) with its own
gating, so a per-button command would leave that gating duplicated five times.
All take a structured `state` DOM property (never an attribute), emit bubbling,
composed events, are controlled (programmatic updates emit nothing), take their
text from `state.translate`, use targets of at least 24px that grow to 44px on
coarse pointers (the phone bars are always 44px), take colours from the
`--pptx-*` tokens and use system colours in forced colors.

| Element                     | `state` fields                                                                                                                                                          | Events                                                                                            | Host hooks stamped on the element                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pptx-ui-read-only-banner`  | `kind`, `messageKey`, `passwordPromptOpen`, `passwordError` (`wrong-password`, `unsupported-algorithm`), `checkingPassword`, `translate`                                | `read-only-request`: `{ id: 'editAnyway'                                                          | 'dismiss'                                                           | 'cancelPassword' }`or`{ id: 'submitPassword', password }` | `data-testid="pptx-readonly-banner"`, `data-kind` |
| `pptx-ui-paste-options`     | `left`, `top` (bottom-right corner of the pasted element, viewport px), `translate`                                                                                     | `paste-options-request`: `{ format }`; `paste-options-dismiss` (no detail)                        | `data-pptx-paste-options`                                           |
| `pptx-ui-compat-toasts`     | `toasts` (first 5 render), `overflowCount`, `rightInset`, `bottomInset`, `translate`                                                                                    | `compat-toasts-request`: `{ id: 'dismissAll' }` or `{ id: 'dismiss', toastId }`                   | `data-testid="pptx-compat-toasts"`                                  |
| `pptx-ui-dialog-footer`     | `actions`: `{ id, label, variant ('secondary'                                                                                                                           | 'primary'                                                                                         | 'warning'), icon, disabled, testId }[]` (labels already translated) | `dialog-footer-request`: `{ id }`                         | none; `focusAction(id)` method                    |
| `pptx-ui-mobile-bar`        | `slideCount`, `activeSheet`, `commentCount`, `hidden`, `disabled` (ids `slides`, `insert`, `inspector`, `comments`, `notes`), `translate`                               | `mobile-bar-request`: `{ id }`                                                                    | none; the `nav` is "Editor actions"                                 |
| `pptx-ui-present-toolbar`   | `current`, `total`, `tool`, `penColor`, `highlighterColor`, `hasAnnotations`, `blackout`, `presenterViewVisible`, `presenterViewActive`, `startTime`, `translate`       | `present-toolbar-request`: `move`, `tool`, `color`, `blackboard`, `clear`, `presenterView`, `end` | `data-pptx-present-toolbar`, `role="toolbar"`                       |
| `pptx-ui-presenter-console` | `active`, `disabled` (control ids), `translate`                                                                                                                         | `presenter-console-request`: `{ id }`                                                             | `data-pptx-presenter-toolbar`, `data-pptx-presenter-strip`          |
| `pptx-ui-mobile-toolbar`    | `editable`, `canUndo`, `canRedo`, `aiVisible`, `aiActive`, `menuOpen`, `hidden`, `disabled` (ids `menu`, `undo`, `redo`, `ai`, `save`, `present`, `share`), `translate` | `mobile-toolbar-request`: `{ id }`; slots `ai` and `collaboration`                                | none; the `toolbar` is "Toolbar"                                    |

Read-only banner. The element owns the lock icon, "Read-only recommended: message"
text, Edit anyway and Dismiss, and the password form (labelled input, Unlock,
Cancel, an `alert` error and `aria-invalid`/`aria-describedby`). The input takes
focus when `passwordPromptOpen` turns on and is cleared when it turns off. Inner
buttons keep the `pptx-readonly-*` test ids. Hosts own unlocking, dismissal and the
password check (`checkModifyPassword`).

Paste options. The host measures the pasted element with `findCanvasElementNode`
(each binding waits its own number of frames for the node to render) and mounts
the element only while a strip should show. The host is the fixed box, 4px from the
corner; the strip inside is named from `pptx.pasteSpecial.optionsLabel`, stops
mousedown from reaching the canvas and arms outside dismissal (pointerdown or
keydown on the window, capture phase) one task after connecting so the paste's own
gesture does not close it. A press inside the strip does not dismiss it (before,
a press could unmount the strip before its click landed); Escape inside it does. A
choice emits the format and then a dismissal, so every host closes the strip.

Compat toasts. The element positions itself with `compatToastStackStyle`, so it
must be a child of the viewer root. It rebuilds only when something visible
changes, which keeps focus on a dismiss button while the notes strip resizes.
Toasts never auto-hide; "Dismiss all" is always offered, including for one toast.

Dialog footer. It is not a dialog shell: the host keeps the modal, backdrop,
dismissal and focus trap. `activateModalFocus` now walks open shadow roots, so
the footer buttons stay inside the Tab cycle of a trapped dialog. Buttons are keyed
by action id and patched in place, so focus and references survive disabling both
actions. Hosts adopt it for the Cancel/OK style rows of Paste Special, Keep
Annotations, the autosave recovery prompt and the signed-deck warning. Other
dialogs keep native footers until adopted (see the migration guide).

Phone bars. `pptx-ui-mobile-bar` is the five-slot bottom bar. Every slot disables at
zero slides (`buildBarActions`), the open sheet is `aria-pressed` with a top pill,
Comments shows a badge capped at `99+`, and Notes is named "Toggle notes". Hosts
can drop a slot (`hidden`) or disable edit-only slots (`disabled`). The host keeps
fixed positioning and any keyboard lift. `pptx-ui-mobile-toolbar` is the compact
top row; Menu, Undo, Redo, AI and Share show only while `editable`, Save and
Present always show unless `hidden`. The AI toggle is drawn by the element when
`aiVisible`; a host that mounts its own (Vanilla) fills the `ai` slot, and a
collaboration pill goes in `collaboration`. Hover colours apply only on devices
that hover, so a tapped slot keeps its pressed colour.

Slide-show chrome. `pptx-ui-present-toolbar` renders the shared
`PRESENT_TOOLBAR_CONTROLS` inventory (ids, order and label keys unchanged, every
control keeps `data-pptx-present-control`) from `PRESENT_TOOLBAR_METRICS`, so the
five bindings can no longer drift in size or order. `state`: `current`, `total`,
`tool`, `penColor`, `highlighterColor`, `hasAnnotations`, `blackout` (with the pen it
marks Blackboard pressed), `presenterViewVisible` (the toggle is absent otherwise),
`presenterViewActive`, `startTime` (epoch ms; the element ticks the elapsed readout,
clamped at zero) and `translate`. Events: one `present-toolbar-request` with
`{ id: 'move', direction }`, `{ id: 'tool', tool }`, `{ id: 'color', tool, color }`,
`{ id: 'blackboard' }`, `{ id: 'clear' }`, `{ id: 'presenterView' }` or `{ id: 'end' }`.
The host is the toolbar: it carries `data-pptx-present-toolbar`, `role="toolbar"`, its
accessible name and `tabindex="-1"` (a running show keeps focus on the stage). The
palettes are element state: a caret or a right click on Pen or Highlighter opens one
(one at a time), and they close on a tool choice, a swatch pick, Blackboard, an
outside mousedown and `closePalettes()`. The host decides whether re-selecting a tool
disarms it (React sets it, Angular and Svelte toggle) and arms the tool after a
swatch pick. The auto-hiding positioner and the annotation model stay with the host.
Targets are 36px and grow to 44px on coarse pointers.

`pptx-ui-presenter-console` renders `PRESENTER_CONSOLE_CONTROLS` with
`data-pptx-presenter-control` ids. `state`: `active` and `disabled` id lists (derive
both with `presenterConsoleViewState(snapshot, audienceOpen)`) and `translate`.
Toggles carry `aria-pressed`; an active control also swaps its icon and label (the
timer's resume glyph, "Close Audience Window"). One `presenter-console-request`
event carries the control id; `presenterConsoleAction(id, snapshot)` resolves it to
`pointer`, `blackout`, `zoom` or a plain action, with the "second press switches it
off" rule built in. The host carries `data-pptx-presenter-toolbar` and
`data-pptx-presenter-strip`.

Adapters: React uses `useWebControl` (a ref, `state` after every render and native
listeners), Vue `.prop` and event directives, Angular schema-enabled bindings
with a translations signal, Svelte `state=` and `on<event>` attributes, Vanilla
direct property assignment and listeners.
