import { getDatabase } from '$lib/db/database.ts'
import { dispatchDatabaseChangedEvent } from '$lib/db/events.ts'
import { UNKNOWN_ITEM, type Track, type Album, type Artist, type Playlist, type PlaylistEntry } from './types.ts'
import { fetchJellyfinItems, fetchJellyfinViews, jellyfinUuidToId } from './jellyfin-adapter.ts'
import { FAVORITE_PLAYLIST_ID } from './playlists-actions.ts'
import { APP_VERSION, APP_CLIENT_NAME, APP_DEVICE_ID } from '$lib/version.ts'

export class JellyfinSyncService {
	isSyncing = $state(false)
	private BATCH_SIZE = 100

	async syncAll() {
		if (this.isSyncing) return
		this.isSyncing = true
		console.log('Jellyfin: Starting optimized bidirectional sync...')

		try {
			// 1. Get Music Libraries (Views)
			const viewsResult = await fetchJellyfinViews()
			const musicViewIds = viewsResult.Items
				.filter((v: any) => v.CollectionType === 'music')
				.map((v: any) => v.Id)
			
			const parentId = musicViewIds.length > 0 ? musicViewIds.join(',') : undefined
			
			// 2. Sync Items in order (Finamp style)
			await this.syncItems('Audio', 'tracks', this.mapTrack, parentId)
			await this.syncItems('MusicAlbum', 'albums', this.mapAlbum, parentId)
			await this.syncItems('MusicArtist', 'artists', this.mapArtist, parentId)
			await this.syncItems('Playlist', 'playlists', this.mapPlaylist) // Playlists are global
			
			// 3. Sync Playlist Contents
			await this.syncAllPlaylistContents()
			
			console.log('Jellyfin: Optimized sync complete.')
		} catch (e) {
			console.error('Jellyfin: Sync failed', e)
		} finally {
			this.isSyncing = false
		}
	}

	private async syncItems(jellyfinType: string, storeName: any, mapper: (item: any) => any, parentId?: string) {
		console.log(`Jellyfin: Syncing ${jellyfinType} (Etag optimized)...`)
		
		let startIndex = 0
		let hasMore = true
		const syncedIds = new Set<number>()
		const allChanges: any[] = []

		while (hasMore) {
			try {
				const params: any = {
					includeItemTypes: jellyfinType,
					recursive: 'true',
					fields: 'UserData,Overview,Genres,ProductionYear,DateCreated,AlbumArtist,Etag',
					startIndex: startIndex.toString(),
					limit: this.BATCH_SIZE.toString(),
				}
				if (parentId && jellyfinType !== 'Playlist') {
					params.parentId = parentId
				}

				const result = await fetchJellyfinItems(params)

				if (!result.Items || result.Items.length === 0) {
					hasMore = false
					break
				}

				const db = await getDatabase()
				const tx = db.transaction([storeName, 'playlistEntries'], 'readwrite')
				const store = tx.objectStore(storeName)

				for (const item of result.Items) {
					const mapped = mapper(item)
					const id = mapped.id
					syncedIds.add(id)

					const existing = await store.get(id)
					
					// Optimized: Only update if Etag changed
					if (!existing || existing.etag !== item.Etag) {
						await store.put(mapped)
						allChanges.push({
							storeName,
							key: id,
							operation: existing ? 'update' : 'add',
						})
					}

					// Sync Favorite status
					if (jellyfinType === 'Audio') {
						const isFavorite = item.UserData?.IsFavorite || false
						const favChange = await this.dbSyncFavoriteStatus(tx.objectStore('playlistEntries'), id, isFavorite)
						if (favChange) allChanges.push(favChange)
					}
				}

				await tx.done
				startIndex += result.Items.length
				hasMore = result.Items.length === this.BATCH_SIZE
				await new Promise(resolve => setTimeout(resolve, 0))

			} catch (e) {
				console.error(`Jellyfin: Batch fetch failed for ${jellyfinType} at index ${startIndex}`, e)
				hasMore = false
			}
		}

		// Cleanup logic
		const db = await getDatabase()
		const tx = db.transaction(storeName, 'readwrite')
		const existingIds = await tx.objectStore(storeName).getAllKeys()
		const ID_OFFSET = 1000000000
		for (const id of existingIds) {
			if (typeof id === 'number' && id >= ID_OFFSET && !syncedIds.has(id)) {
				await tx.objectStore(storeName).delete(id)
				allChanges.push({ storeName, key: id, operation: 'delete' })
			}
		}
		await tx.done

		if (allChanges.length > 0) {
			dispatchDatabaseChangedEvent(allChanges)
		}
	}

	private async dbSyncFavoriteStatus(store: any, trackId: number, isFavorite: boolean) {
		const existing = await store.index('playlistTrack').get([FAVORITE_PLAYLIST_ID, trackId])
		
		if (isFavorite && !existing) {
			const entry: Omit<PlaylistEntry, 'id'> = {
				playlistId: FAVORITE_PLAYLIST_ID,
				trackId,
				addedAt: Date.now(),
			}
			const id = await store.add(entry)
			return { storeName: 'playlistEntries', key: id, operation: 'add', value: { ...entry, id } }
		} else if (!isFavorite && existing) {
			await store.delete(existing.id)
			return { storeName: 'playlistEntries', key: existing.id, operation: 'delete', value: existing }
		}
		return null
	}

	private async syncAllPlaylistContents() {
		const db = await getDatabase()
		const playlists = await db.getAll('playlists')
		const ID_OFFSET = 1000000000

		for (const playlist of playlists) {
			if (playlist.id >= ID_OFFSET && playlist.id !== FAVORITE_PLAYLIST_ID) {
				await this.syncPlaylistContent(playlist)
			}
		}
	}

	private async syncPlaylistContent(playlist: Playlist) {
		try {
			const jellyfin = (await import('$lib/stores/jellyfin.svelte.ts')).useJellyfinStore()
			const response = await fetch(`${jellyfin.serverUrl}/Playlists/${playlist.uuid}/Items?userId=${jellyfin.userId}`, {
				headers: {
					'X-Emby-Authorization': `MediaBrowser Client="${APP_CLIENT_NAME}", Device="Web Browser", DeviceId="${APP_DEVICE_ID}", Version="${APP_VERSION}", Token="${jellyfin.accessToken}"`,
				},
			})
			if (!response.ok) return
			const result = await response.json()

			const db = await getDatabase()
			const tx = db.transaction('playlistEntries', 'readwrite')
			const store = tx.objectStore('playlistEntries')

			const localEntries = await store.index('playlistTrack').getAll(IDBKeyRange.bound([playlist.id], [playlist.id, []]))
			const localTrackIds = new Set(localEntries.map(e => e.trackId))
			const remoteTrackIds = new Set<number>()
			const changes: any[] = []

			for (const item of result.Items) {
				const trackId = jellyfinUuidToId(item.Id)
				remoteTrackIds.add(trackId)

				if (!localTrackIds.has(trackId)) {
					const entry: Omit<PlaylistEntry, 'id'> = {
						playlistId: playlist.id,
						trackId,
						addedAt: Date.now(),
					}
					const id = await store.add(entry)
					changes.push({ storeName: 'playlistEntries', key: id, operation: 'add', value: { ...entry, id } })
				}
			}

			for (const entry of localEntries) {
				if (!remoteTrackIds.has(entry.trackId)) {
					await store.delete(entry.id)
					changes.push({ storeName: 'playlistEntries', key: entry.id, operation: 'delete', value: entry })
				}
			}

			await tx.done
			if (changes.length > 0) dispatchDatabaseChangedEvent(changes)
		} catch (e) {
			console.error(`Jellyfin: Failed to sync playlist content for ${playlist.name}`, e)
		}
	}

	private mapTrack(item: any): Track {
		return {
			id: jellyfinUuidToId(item.Id),
			uuid: item.Id,
			name: item.Name,
			album: item.Album || UNKNOWN_ITEM,
			artists: item.Artists || [UNKNOWN_ITEM],
			year: item.ProductionYear?.toString() || UNKNOWN_ITEM,
			duration: Math.round((item.RunTimeTicks || 0) / 10000000),
			genre: item.Genres || [],
			trackNo: item.IndexNumber || 0,
			trackOf: 0,
			discNo: item.ParentIndexNumber || 1,
			discOf: 0,
			fileName: item.Path || '',
			directory: -1,
			scannedAt: Date.now(),
			file: {} as any,
			favorite: item.UserData?.IsFavorite || false,
			etag: item.Etag,
			source: 'jellyfin',
		}
	}

	private mapAlbum(item: any): Album {
		return {
			id: jellyfinUuidToId(item.Id),
			uuid: item.Id,
			name: item.Name,
			artists: item.AlbumArtist ? [item.AlbumArtist] : (item.Artists || []),
			year: item.ProductionYear?.toString(),
			etag: item.Etag,
			source: 'jellyfin',
		}
	}

	private mapArtist(item: any): Artist {
		return {
			id: jellyfinUuidToId(item.Id),
			uuid: item.Id,
			name: item.Name,
			etag: item.Etag,
			source: 'jellyfin',
		}
	}

	private mapPlaylist(item: any): Playlist {
		return {
			id: jellyfinUuidToId(item.Id),
			uuid: item.Id,
			name: item.Name,
			description: item.Overview || '',
			createdAt: item.DateCreated ? new Date(item.DateCreated).getTime() : Date.now(),
			etag: item.Etag,
			source: 'jellyfin',
		}
	}
}

let jellyfinSyncService: JellyfinSyncService | undefined

export const useJellyfinSyncService = () => {
	if (!jellyfinSyncService) {
		jellyfinSyncService = new JellyfinSyncService()
	}
	return jellyfinSyncService
}
