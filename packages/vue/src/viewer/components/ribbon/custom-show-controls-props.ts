import type { CustomShowsControlsProps, RibbonProps } from './ribbon-types';

/**
 * Narrow the aggregate ribbon contract down to the custom-show picker's own.
 *
 * Two places render the picker (the quick-access row and the Slide Show tab's
 * popover), and each of them otherwise has to restate nine fields by hand.
 * Deriving the bundle in one place is what keeps the two copies from drifting
 * into passing different halves of it, which is exactly how one of them ends up
 * with a Rename button that renames nothing.
 */
export function toCustomShowsControlsProps(props: RibbonProps): CustomShowsControlsProps {
	return {
		customShows: props.customShows,
		activeCustomShowId: props.activeCustomShowId,
		canEdit: props.canEdit,
		isCurrentSlideInActiveShow: props.isCurrentSlideInActiveShow,
		onSetActiveCustomShowId: props.onSetActiveCustomShowId,
		onCreateCustomShow: props.onCreateCustomShow,
		onRenameActiveCustomShow: props.onRenameActiveCustomShow,
		onDeleteActiveCustomShow: props.onDeleteActiveCustomShow,
		onToggleCurrentSlideInActiveShow: props.onToggleCurrentSlideInActiveShow,
	};
}
