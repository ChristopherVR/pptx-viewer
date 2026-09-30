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
