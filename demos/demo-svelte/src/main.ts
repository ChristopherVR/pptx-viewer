import { mount } from 'svelte';

import { externalSessionRequested } from '../../shared/host-owned-collaboration';
import App from './App.svelte';
import HostOwnedDemo from './HostOwnedDemo.svelte';

import './styles.css';

/** Demo entry point: mounts the Svelte demo shell. */
const appRoot = document.getElementById('app');
if (!appRoot) {
	throw new Error('missing #app root');
}

mount(externalSessionRequested() ? HostOwnedDemo : App, { target: appRoot });
