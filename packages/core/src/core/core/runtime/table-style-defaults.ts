/**
 * Default table style GUID that PowerPoint's "Insert > Table" UI applies
 * when the user hasn't picked a specific style. This is "Medium Style 2 -
 * Accent 1" (a blue header row with banded white rows) and is defined in
 * PowerPoint's built-in `ppt/tableStyles.xml`. A table with no
 * `<a:tableStyleId>` renders unstyled (no borders, no fill) in PowerPoint,
 * so every table CREATION path (SDK factory, raw-XML insert builder) seeds
 * this id explicitly.
 *
 * The save pipeline deliberately does NOT inject it: a loaded table that
 * legitimately carries no style ("No Style, No Grid") must round-trip
 * without one. See `serializeTablePropertyFlags`.
 *
 * @module runtime/table-style-defaults
 */
export const DEFAULT_POWERPOINT_TABLE_STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';
