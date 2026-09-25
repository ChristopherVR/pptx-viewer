/**
 * Shape of a ribbon control catalogue entry.
 *
 * @module render/customization/ribbon-control-catalog-types
 */
export type ControlLabels = Readonly<Record<string, string>>;
export interface GroupEntry {
	readonly label: string;
	readonly controls: ControlLabels;
}
export type TabEntry = Readonly<Record<string, GroupEntry>>;
