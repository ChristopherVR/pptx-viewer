import React, { useEffect, useLayoutEffect, useRef } from 'react';

type Host = HTMLElement & { value: string; checked: boolean; disabled: boolean };
type NativeEventHandler = (event: Event) => void;
type CommonProps = Omit<
	React.HTMLAttributes<HTMLElement>,
	'onChange' | 'onInput' | 'onFocus' | 'onBlur' | 'onKeyDown'
>;

function useHostEvent(
	ref: React.RefObject<Host | null>,
	type: string,
	handler?: NativeEventHandler,
): void {
	useEffect(() => {
		const host = ref.current;
		if (!host || !handler) {
			return;
		}
		host.addEventListener(type, handler);
		return () => host.removeEventListener(type, handler);
	}, [ref, type, handler]);
}

/** React 18 needs native listeners for custom element events. */
export function WebSearch({
	value,
	disabled = false,
	onInput,
	onChange,
	onFocus,
	onBlur,
	onKeyDown,
	...rest
}: CommonProps & {
	value: string;
	disabled?: boolean;
	placeholder?: string;
	variant?: 'titlebar';
	onInput?: NativeEventHandler;
	onChange?: NativeEventHandler;
	onFocus?: NativeEventHandler;
	onBlur?: NativeEventHandler;
	onKeyDown?: (event: KeyboardEvent) => void;
}): React.ReactElement {
	const ref = useRef<Host>(null);
	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.value = value;
			ref.current.disabled = disabled;
		}
	}, [value, disabled]);
	useHostEvent(ref, 'input', onInput);
	useHostEvent(ref, 'change', onChange);
	useHostEvent(ref, 'focusin', onFocus);
	useHostEvent(ref, 'focusout', onBlur);
	useHostEvent(ref, 'keydown', onKeyDown as NativeEventHandler | undefined);
	return <pptx-ui-search ref={ref} value={value} disabled={disabled || undefined} {...rest} />;
}

export function WebSelect({
	value,
	disabled = false,
	onChange,
	...rest
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
	value: string | number;
	onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}): React.ReactElement {
	const ref = useRef<Host>(null);
	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.value = String(value);
			ref.current.disabled = disabled;
		}
	}, [value, disabled]);
	useHostEvent(
		ref,
		'change',
		onChange
			? (event) => onChange(event as unknown as React.ChangeEvent<HTMLSelectElement>)
			: undefined,
	);
	return (
		<pptx-ui-select ref={ref} value={String(value)} disabled={disabled || undefined} {...rest} />
	);
}

export function WebCheckbox({
	checked,
	disabled = false,
	onChange,
	value,
	...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange'> & {
	checked: boolean;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
}): React.ReactElement {
	const ref = useRef<Host>(null);
	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.checked = checked;
			ref.current.disabled = disabled;
		}
	}, [checked, disabled]);
	useHostEvent(
		ref,
		'change',
		onChange
			? (event) => onChange(event as unknown as React.ChangeEvent<HTMLInputElement>)
			: undefined,
	);
	return (
		<pptx-ui-checkbox
			ref={ref}
			checked={checked || undefined}
			disabled={disabled || undefined}
			value={value === undefined ? undefined : String(value)}
			{...rest}
		/>
	);
}
