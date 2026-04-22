import { useJellyfinStore } from '$lib/stores/jellyfin.svelte.ts'
import type { AlbumData, ArtistData, PlaylistData, TrackData } from './get/value.ts'
import { UNKNOWN_ITEM } from './types.ts'
import { APP_VERSION, APP_CLIENT_NAME, APP_DEVICE_ID } from '$lib/version.ts'

// Jellyfin uses UUIDs, but this app uses numbers for IDs.
// We'll create a mapping that can be stored in the database.
const ID_OFFSET = 1000000000 

export const jellyfinUuidToId = (uuid: string): number => {
	let hash = 0
	for (let i = 0; i < uuid.length; i++) {
		const char = uuid.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash |= 0 // Convert to 32bit integer
	}
	return ID_OFFSET + Math.abs(hash)
}

export const isJellyfinId = (id: number): boolean => id >= ID_OFFSET

const getJellyfinAuthHeader = () => {
	const jellyfin = useJellyfinStore()
	return {
		'X-Emby-Authorization': `MediaBrowser Client="${APP_CLIENT_NAME}", Device="Web Browser", DeviceId="${APP_DEVICE_ID}", Version="${APP_VERSION}", Token="${jellyfin.accessToken}"`,
	}
}

export const fetchJellyfinItems = async (params: Record<string, string>) => {
	const jellyfin = useJellyfinStore()
	if (!jellyfin.isLoggedIn) return { Items: [] }

	const query = new URLSearchParams({
		userId: jellyfin.userId!,
		...params,
	})

	const response = await fetch(`${jellyfin.serverUrl}/Items?${query.toString()}`, {
		headers: getJellyfinAuthHeader(),
	})

	if (!response.ok) throw new Error('Jellyfin request failed')
	return response.json()
}

export const fetchJellyfinViews = async () => {
	const jellyfin = useJellyfinStore()
	if (!jellyfin.isLoggedIn) return { Items: [] }

	const response = await fetch(`${jellyfin.serverUrl}/Users/${jellyfin.userId}/Views`, {
		headers: getJellyfinAuthHeader(),
	})

	if (!response.ok) throw new Error('Jellyfin request failed')
	return response.json()
}

export const getJellyfinImageUrl = (itemId: string, width = 500, height = 500) => {
	const jellyfin = useJellyfinStore()
	if (!jellyfin.isLoggedIn) return ''
	return `${jellyfin.serverUrl}/Items/${itemId}/Images/Primary?maxWidth=${width}&maxHeight=${height}&api_key=${jellyfin.accessToken}`
}

export const getJellyfinAudioUrl = (itemId: string) => {
	const jellyfin = useJellyfinStore()
	if (!jellyfin.isLoggedIn) return ''
	
	const params = new URLSearchParams({
		api_key: jellyfin.accessToken!,
		static: (!jellyfin.shouldTranscode).toString(),
	})

	if (jellyfin.shouldTranscode) {
		params.append('audioBitrate', (jellyfin.transcodeBitrate * 1000).toString())
		params.append('container', 'mp3,aac,m4a,flac,wav') // Supported containers
	}

	return `${jellyfin.serverUrl}/Audio/${itemId}/stream?${params.toString()}`
}

export const reportJellyfinSession = async () => {
	const jellyfin = useJellyfinStore()
	if (!jellyfin.isLoggedIn) return

	try {
		await fetch(`${jellyfin.serverUrl}/Sessions/Capabilities/Full`, {
			method: 'POST',
			headers: {
				...getJellyfinAuthHeader(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				Capabilities: {
					PlayableMediaTypes: ['Audio'],
					SupportedCommands: [
						'Play',
						'Pause',
						'Stop',
						'PlayNext',
						'PlayPrevious',
						'Seek',
						'SetVolume',
						'Mute',
						'Unmute',
					],
					SupportsMediaControl: true,
					SupportsPersistentIdentifier: true,
				},
			}),
		})
	} catch (e) {
		console.error('Failed to report Jellyfin session:', e)
	}
}

export const reportJellyfinPlayback = async (
	action: 'start' | 'progress' | 'stop',
	itemId: string,
	options: {
		positionTicks?: number
		isPaused?: boolean
		isMuted?: boolean
		volumeLevel?: number
		repeatMode?: string
	} = {},
) => {
	const jellyfin = useJellyfinStore()
	if (!jellyfin.isLoggedIn) return

	const endpointMap = {
		start: '/Sessions/Playing',
		progress: '/Sessions/Playing/Progress',
		stop: '/Sessions/Playing/Stopped',
	}

	const body: any = {
		ItemId: itemId,
		CanSeek: true,
		IsPaused: options.isPaused ?? false,
		IsMuted: options.isMuted ?? false,
		PositionTicks: options.positionTicks ?? 0,
		VolumeLevel: options.volumeLevel ?? 100,
		PlayMethod: jellyfin.shouldTranscode ? 'Transcode' : 'DirectPlay',
		RepeatMode: options.repeatMode ?? 'RepeatNone',
	}

	try {
		await fetch(`${jellyfin.serverUrl}${endpointMap[action]}`, {
			method: 'POST',
			headers: {
				...getJellyfinAuthHeader(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})
	} catch (e) {
		console.error(`Failed to report Jellyfin playback ${action}:`, e)
	}
}

export const toggleJellyfinFavorite = async (itemId: string, isFavorite: boolean) => {
	const jellyfin = useJellyfinStore()
	if (!jellyfin.isLoggedIn) return

	try {
		await fetch(`${jellyfin.serverUrl}/Users/${jellyfin.userId}/FavoriteItems/${itemId}`, {
			method: isFavorite ? 'POST' : 'DELETE',
			headers: getJellyfinAuthHeader(),
		})
	} catch (e) {
		console.error('Failed to toggle Jellyfin favorite:', e)
	}
}
