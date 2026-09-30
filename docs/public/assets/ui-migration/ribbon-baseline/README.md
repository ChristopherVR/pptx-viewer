# Ribbon migration baseline

Captured from main commit `15e3ea7d279a6c1f220b1e130c2d0d8125852838`
at 1440 x 900 before migrating the remaining ribbon families.

Each binding has eight regular-tab captures (Home, Insert, Draw, Design,
Transitions, Animations, Review, View) using the demo presentation. Five
contextual-tab captures use `ribbon-galleries.pptx`, except SmartArt Design uses
`smartart-build-reveal.pptx`. The filename begins with the binding and ends with
the canonical tab name. The same selection and fixture are used across all five.

The inventory and host boundary are defined by `RIBBON_CONTROL_CATALOG`,
`CONTEXTUAL_TAB_GROUPS`, `FIXED_TAB_GALLERIES` and the shared web-control README.
Stable `data-ribbon-control` and `data-ribbon-group` IDs are retained, including
per-control and per-group customization. Framework adapters retain document
mutation, undo/history, persistence, native file access and dialog lifecycle.
