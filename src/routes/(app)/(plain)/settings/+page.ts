import { getDatabase } from '$lib/db/database.ts'
import { createPageQuery, type PageQueryResult } from '$lib/db/query/page-query.svelte.ts'
import { debounce } from '$lib/helpers/utils/debounce.ts'
import { type Directory, LEGACY_NO_NATIVE_DIRECTORY } from '$lib/library/types.ts'

export type DirectoryWithCount = { count: number } & (
	| {
			id: typeof LEGACY_NO_NATIVE_DIRECTORY
			legacy: true
	  }
	| {
			id: 'jellyfin'
			jellyfin: true
			serverName: string
	  }
	| (Directory & { legacy?: false; jellyfin?: false })
)

const debouncedRefetch = debounce((refetch: () => void) => {
	refetch()
}, 100)

const createDirectoriesPageQuery = () =>
	createPageQuery({
		key: [],
		fetcher: async (): Promise<DirectoryWithCount[]> => {
			const db = await getDatabase()
			const directories = await db.getAll('directories')
			const tx = db.transaction('tracks')
			const store = tx.objectStore('tracks')
			
			const results: DirectoryWithCount[] = []

			// 1. Native Directories
			for (const dir of directories) {
				results.push({
					...dir,
					count: await store.index('directory').count(dir.id)
				})
			}

			// 2. Legacy/App Storage (Local files without a native directory)
			// We only count local tracks (source !== 'jellyfin') with directory -1
			let legacyCount = 0
			for await (const cursor of store.index('directory').iterate(LEGACY_NO_NATIVE_DIRECTORY)) {
				if (cursor.value.source !== 'jellyfin') {
					legacyCount++
				}
			}
			
			if (legacyCount > 0) {
				results.push({
					id: LEGACY_NO_NATIVE_DIRECTORY,
					legacy: true,
					count: legacyCount
				})
			}

			// 3. Jellyfin Library
			let jellyfinCount = 0
			// We can use a separate index for source if it existed, but for now we'll iterate or just count
			// Since we want efficiency, let's assume all tracks with directory -1 and source jellyfin are Jellyfin
			// Or better, let's just count all tracks with source: 'jellyfin'
			for await (const cursor of store) {
				if (cursor.value.source === 'jellyfin') {
					jellyfinCount++
				}
			}

			if (jellyfinCount > 0) {
				const { useJellyfinStore } = await import('$lib/stores/jellyfin.svelte.ts')
				const jellyfin = useJellyfinStore()
				results.push({
					id: 'jellyfin' as any,
					jellyfin: true,
					count: jellyfinCount,
					serverName: jellyfin.serverName ?? 'Jellyfin'
				})
			}

			return results
		},
		onDatabaseChange: (changes, { refetch }) => {
			for (const change of changes) {
				if (change.storeName === 'tracks' || change.storeName === 'directories') {
					debouncedRefetch(refetch)
					break
				}
			}
		},
	})

interface LoadResult {
	directoriesQuery: PageQueryResult<DirectoryWithCount[]>
	title: string
}

export const load = async (): Promise<LoadResult> => {
	const directories = await createDirectoriesPageQuery()

	return {
		directoriesQuery: directories,
		title: m.settings(),
	}
}
