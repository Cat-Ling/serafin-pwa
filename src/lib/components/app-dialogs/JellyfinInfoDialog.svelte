<script lang="ts">
	import Dialog from '../dialog/Dialog.svelte'
	import DialogFooter, { type DialogButton } from '../dialog/DialogFooter.svelte'
	import { useDialogsStore } from '$lib/stores/dialogs/use-store.ts'
	import { useJellyfinStore } from '$lib/stores/jellyfin.svelte.ts'
	import { APP_VERSION, APP_CLIENT_NAME, APP_DEVICE_ID } from '$lib/version.ts'

	const dialogs = useDialogsStore()
	const jellyfin = useJellyfinStore()

	let stats = $state<{ os?: string; cpu?: string; architecture?: string }>({})

	$effect(() => {
		if (dialogs.jellyfinInfoDialogOpen && jellyfin.isLoggedIn) {
			fetch(`${jellyfin.serverUrl}/System/Info`, {
				headers: {
					'X-Emby-Authorization': `MediaBrowser Client="${APP_CLIENT_NAME}", Device="Web Browser", DeviceId="${APP_DEVICE_ID}", Version="${APP_VERSION}", Token="${jellyfin.accessToken}"`,
				},
			})
				.then((r) => r.json())
				.then((data) => {
					stats = {
						os: data.OperatingSystem,
						cpu: data.ProcessorCount ? `${data.ProcessorCount} cores` : undefined,
						architecture: data.Architecture,
					}
				})
				.catch(console.error)
		}
	})

	const logout = () => {
		jellyfin.logout()
		dialogs.jellyfinInfoDialogOpen = false
	}

	const buttons: DialogButton[] = [
		{
			title: 'Close',
			type: 'close',
		},
		{
			title: 'Logout',
			kind: 'flat',
			action: logout,
		},
	]
</script>

<Dialog bind:open={dialogs.jellyfinInfoDialogOpen} title="Jellyfin Connection">
	<div class="flex flex-col gap-2 p-6">
		<div class="flex justify-between">
			<span class="text-onSurfaceVariant">User:</span>
			<span class="font-bold">{jellyfin.username}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-onSurfaceVariant">Server:</span>
			<span>{jellyfin.serverName}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-onSurfaceVariant">Version:</span>
			<span class="tabular-nums">{jellyfin.serverVersion}</span>
		</div>

		{#if stats.os}
			<div class="flex justify-between">
				<span class="text-onSurfaceVariant">OS:</span>
				<span>{stats.os}</span>
			</div>
		{/if}
		{#if stats.cpu}
			<div class="flex justify-between">
				<span class="text-onSurfaceVariant">CPU:</span>
				<span>{stats.cpu}</span>
			</div>
		{/if}

		<div class="mt-2 flex flex-col truncate text-body-sm text-onSurfaceVariant">
			<span>URL:</span>
			<span class="truncate">{jellyfin.serverUrl}</span>
		</div>
	</div>

	<DialogFooter {buttons} onclose={() => (dialogs.jellyfinInfoDialogOpen = false)} />
</Dialog>
