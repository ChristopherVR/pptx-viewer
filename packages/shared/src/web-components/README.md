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
typeahead, Enter, Space, and Escape, and skips disabled choices. Checkbox
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

Requests bubble and are composed; programmatic attribute changes never emit
requests. Toggle state remains controlled until the host commits it. Commands
use native button focus, Enter, Space and disabled behavior. Both the group and
its slotted controls retain light-DOM customization ids. Each adapter preserves
its existing dialog, document-edit and popup lifecycle. `SLIDE_SHOW_COMMAND_GROUPS`
owns labels, tooltips, order, icons and unsupported-command metadata in shared
render code. Other ribbon tabs continue using their current views until migrated.

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

| Family             | Default state                                                                                                    | Programmatic updates                                                                             | User events                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Search             | Empty value/placeholder, enabled; name falls back to placeholder or Search                                       | `value`, `disabled`; attributes placeholder, value, aria-label, disabled                         | Native `input` then `change` as the inner search input produces them; read host value             |
| Checkbox           | Unchecked, enabled, value `on`; host supplies accessible name                                                    | `checked`, `disabled`, `value` properties or attributes                                          | `input` then `change` after activation; read host checked                                         |
| Select             | First selected or eligible option, otherwise empty; enabled                                                      | `value`, `selectedIndex`, disabled; children define readonly options list                        | `input` then `change` only when a different eligible option is committed; read host value         |
| Slide Show options | Timings/narration enabled by default; unsupported options unchecked/disabled; labels default to translation keys | DOM `presentationProperties`, `labels`, disabled                                                 | One `show-options-change` with a presentation-property patch; host commits before display changes |
| Ribbon command     | Enabled, ordinary size, inactive; no pressed/expanded state                                                      | Attributes label, icon, title, disabled, active, compact, pressed, expanded and customization id | One `command-request` with `{ id }`; host owns action                                             |
| Ribbon toggle      | Unchecked, enabled                                                                                               | Attributes label, title, checked, disabled and customization id                                  | One `toggle-request` with `{ id, checked }`; host commits before display changes                  |
| Ribbon group       | Empty label and content                                                                                          | Label and optional group id; default slot                                                        | None                                                                                              |

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

| Family      | Element                         | Controls                                                           |
| ----------- | ------------------------------- | ------------------------------------------------------------------ |
| `clipboard` | `pptx-ui-ribbon-home-clipboard` | The whole `home.clipboard` group: Paste, Cut, Copy, Format Painter |

`clipboardHomeControls` fixes the gating once: Paste needs edit rights and a
clipboard, Cut needs edit rights and a selection, Copy needs only a selection,
and the Format Painter needs edit rights plus a formattable selection but stays
enabled while armed so it can be cancelled. Hosts without a Format Painter hide
it with `hidden`. The painter button keeps `data-testid="format-painter-toggle"`
and mirrors its armed state in `data-active`. Native hosts retain every
clipboard action, history and persistence. The former React and Vue green
"copied/cut" flash was cosmetic, existed in two of five bindings, and is not
carried over.
