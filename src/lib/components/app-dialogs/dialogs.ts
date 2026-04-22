import ConfirmRemoveLibraryItem from './ConfirmRemoveLibraryItem.svelte'
import EqualizerDialog from './EqualizerDialog.svelte'
import JellyfinInfoDialog from './JellyfinInfoDialog.svelte'
import JellyfinLoginDialog from './JellyfinLoginDialog.svelte'
import AddToPlaylistDialog from './playlists/AddToPlaylistDialog.svelte'
import EditPlaylistDialog from './playlists/EditPlaylistDialog.svelte'
import NewPlaylistDialog from './playlists/NewPlaylistDialog.svelte'

export const APP_DIALOGS_COMPONENTS = [
	ConfirmRemoveLibraryItem,
	EqualizerDialog,
	AddToPlaylistDialog,
	NewPlaylistDialog,
	EditPlaylistDialog,
	JellyfinLoginDialog,
	JellyfinInfoDialog,
] as const
