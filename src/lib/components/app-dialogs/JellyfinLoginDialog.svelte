<script lang="ts">
	import Dialog from '../dialog/Dialog.svelte'
	import DialogFooter, { type DialogButton } from '../dialog/DialogFooter.svelte'
	import TextField from '../TextField.svelte'
	import { useDialogsStore } from '$lib/stores/dialogs/use-store.ts'
	import { useJellyfinStore } from '$lib/stores/jellyfin.svelte.ts'
	import { reportJellyfinSession } from '$lib/library/jellyfin-adapter.ts'
	import { useJellyfinSyncService } from '$lib/library/jellyfin-sync.svelte.ts'
	import { APP_VERSION, APP_CLIENT_NAME, APP_DEVICE_ID } from '$lib/version.ts'

	const dialogs = useDialogsStore()
	const jellyfin = useJellyfinStore()
	const syncService = useJellyfinSyncService()

	let serverUrl = $state(jellyfin.serverUrl ?? '')
	let username = $state('')
	let password = $state('')
	let error = $state<string | null>(null)
	let loading = $state(false)

	const login = async () => {
		loading = true
		error = null
		try {
			// Normalize URL
			let url = serverUrl.trim()
			if (!url.startsWith('http')) {
				url = 'http://' + url
			}
			if (url.endsWith('/')) {
				url = url.slice(0, -1)
			}

			// First verify server and get info
			const infoResponse = await fetch(`${url}/System/Info/Public`)
			if (!infoResponse.ok) {
				throw new Error('Could not connect to Jellyfin server')
			}
			const info = await infoResponse.json()

			const response = await fetch(`${url}/Users/AuthenticateByName`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Emby-Authorization': `MediaBrowser Client="${APP_CLIENT_NAME}", Device="Web Browser", DeviceId="${APP_DEVICE_ID}", Version="${APP_VERSION}"`,
				},
				body: JSON.stringify({
					Username: username,
					Pw: password,
				}),
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Invalid username or password')
				}
				throw new Error('Login failed')
			}

			const data = await response.json()
			jellyfin.serverUrl = url
			jellyfin.accessToken = data.AccessToken
			jellyfin.userId = data.User.Id
			jellyfin.username = data.User.Name
			jellyfin.serverName = info.ServerName
			jellyfin.serverVersion = info.Version
			
			void reportJellyfinSession()
			void syncService.syncAll()
			dialogs.jellyfinLoginDialogOpen = false
		} catch (e) {
			error = e instanceof Error ? e.message : 'Login failed'
		} finally {
			loading = false
		}
	}

	const buttons: DialogButton[] = [
		{
			title: 'Cancel',
			type: 'close',
		},
		{
			title: 'Login',
			kind: 'toned',
			type: 'button',
			action: login,
		},
	]
</script>

<Dialog bind:open={dialogs.jellyfinLoginDialogOpen} title="Jellyfin Login">
	<div class="flex flex-col gap-4 p-6">
		<TextField name="serverUrl" bind:value={serverUrl} placeholder="Server URL (e.g. http://192.168.1.10:8096)" required />
		<TextField name="username" bind:value={username} placeholder="Username" required />
		<TextField name="password" bind:value={password} type="password" placeholder="Password" />
		
		{#if error}
			<div class="text-error text-body-sm">{error}</div>
		{/if}

		{#if loading}
			<div class="text-body-sm">Connecting...</div>
		{/if}
	</div>

	<DialogFooter {buttons} onclose={() => (dialogs.jellyfinLoginDialogOpen = false)} />
</Dialog>
