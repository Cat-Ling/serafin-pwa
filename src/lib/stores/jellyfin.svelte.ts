import { getPersistedValue, persist } from '$lib/helpers/persist.svelte.ts'
import { reportJellyfinSession } from '$lib/library/jellyfin-adapter.ts'
import { useJellyfinSyncService } from '$lib/library/jellyfin-sync.svelte.ts'

export type ContentViewType = 'list' | 'grid'

export class JellyfinStore {
	// Connection
	serverUrl: string | null = $state(getPersistedValue('jellyfin', 'serverUrl', null))
	accessToken: string | null = $state(getPersistedValue('jellyfin', 'accessToken', null))
	userId: string | null = $state(getPersistedValue('jellyfin', 'userId', null))
	username: string | null = $state(getPersistedValue('jellyfin', 'username', null))
	serverName: string | null = $state(getPersistedValue('jellyfin', 'serverName', null))
	serverVersion: string | null = $state(getPersistedValue('jellyfin', 'serverVersion', null))
	
	// Settings inherited from Finamp
	shouldTranscode: boolean = $state(getPersistedValue('jellyfin', 'shouldTranscode', false))
	transcodeBitrate: number = $state(getPersistedValue('jellyfin', 'transcodeBitrate', 192)) // kbps
	contentViewType: ContentViewType = $state(getPersistedValue('jellyfin', 'contentViewType', 'grid'))
	gridColumnsPortrait: number = $state(getPersistedValue('jellyfin', 'gridColumnsPortrait', 2))
	gridColumnsLandscape: number = $state(getPersistedValue('jellyfin', 'gridColumnsLandscape', 4))
	showTextOnGridView: boolean = $state(getPersistedValue('jellyfin', 'showTextOnGridView', true))
	showCoverAsPlayerBackground: boolean = $state(getPersistedValue('jellyfin', 'showCoverAsPlayerBackground', true))
	hideSongArtistsIfSameAsAlbum: boolean = $state(getPersistedValue('jellyfin', 'hideSongArtistsIfSameAsAlbum', true))
	songShuffleItemCount: number = $state(getPersistedValue('jellyfin', 'songShuffleItemCount', 500))

	get isLoggedIn(): boolean {
		return !!(this.serverUrl && this.accessToken && this.userId)
	}

	constructor() {
		persist('jellyfin', this, [
			'serverUrl', 
			'accessToken', 
			'userId', 
			'username', 
			'serverName', 
			'serverVersion',
			'shouldTranscode',
			'transcodeBitrate',
			'contentViewType',
			'gridColumnsPortrait',
			'gridColumnsLandscape',
			'showTextOnGridView',
			'showCoverAsPlayerBackground',
			'hideSongArtistsIfSameAsAlbum',
			'songShuffleItemCount'
		])

		if (this.isLoggedIn) {
			void reportJellyfinSession()
			void useJellyfinSyncService().syncAll()
		}
	}

	logout() {
		this.serverUrl = null
		this.accessToken = null
		this.userId = null
		this.username = null
		this.serverName = null
		this.serverVersion = null
	}
}

let jellyfinStore: JellyfinStore | undefined

export const useJellyfinStore = () => {
	if (!jellyfinStore) {
		jellyfinStore = new JellyfinStore()
	}
	return jellyfinStore
}
