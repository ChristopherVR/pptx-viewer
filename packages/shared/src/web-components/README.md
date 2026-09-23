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
