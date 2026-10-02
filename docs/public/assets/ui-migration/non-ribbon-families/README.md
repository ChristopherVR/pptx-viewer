# Non-ribbon family evidence (#386)

Every family has a `<family>-<binding>-before.png` and a `<family>-<binding>-after.png`
for React, Vue, Angular, Svelte and Vanilla.

- **Before** is main at `7950a5efb` (the Home and status-bar work not yet merged).
- **After** is the `ui/non-ribbon-families-2` branch, except `status-bar-*-after.png`,
  which is the `ui/non-ribbon-buttons` branch (#390, `4e43eab5d`) because the status
  bar migration landed there.
- Desktop captures use a 1440 x 900 viewport. The mobile bars use 390 x 844 with touch.

| Family                      | Captured from                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `status-bar`                | The bottom 60px of the editor with `sample-deck.pptx`.                                                 |
| `read-only-banner`          | `modify-password.pptx`, banner with Edit anyway and Dismiss.                                           |
| `read-only-banner-password` | The same banner after Edit anyway and a wrong password: the inline form, `aria-invalid` and the error. |
| `compat-toasts`             | `ole-embed.pptx`, which raises a real load notice.                                                     |
| `paste-options`             | `sample-deck.pptx`: copy the "Product Overview" shape and paste; the strip with its page context.      |
| `dialog-footer`             | The Paste Special dialog (`Ctrl+Alt+V`), showing the Cancel / OK footer.                               |
| `mobile-bottom-bar`         | The five-slot phone bar, `sample-deck.pptx`.                                                           |
| `mobile-toolbar`            | The compact phone top row, `sample-deck.pptx`.                                                         |
| `present-toolbar`           | The slide-show toolbar after the pointer moves.                                                        |
| `present-toolbar-palette`   | The same toolbar with the Pen colour palette open.                                                     |
| `presenter-console`         | The presenter console strip (opened from the Presenter view toggle).                                   |

The captures come from the same neutral locators in all five bindings (test ids,
roles and accessible names), so a before and an after of one family are directly
comparable. The matching browser spec is `e2e/chrome-controls-migration.spec.ts`.
