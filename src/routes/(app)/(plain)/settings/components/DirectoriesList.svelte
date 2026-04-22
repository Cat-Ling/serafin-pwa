<script lang="ts">
	import { ripple } from '$lib/attachments/ripple.ts'
	import { tooltip } from '$lib/attachments/tooltip.ts'
	import CommonDialog from '$lib/components/dialog/CommonDialog.svelte'
	import IconButton from '$lib/components/IconButton.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import WrapTranslation from '$lib/components/WrapTranslation.svelte'
	import {
		getFilesFromLegacyDirectory,
		isFileSystemAccessSupported,
	} from '$lib/helpers/file-system.ts'
	import { isAndroid } from '$lib/helpers/utils/ua.ts'
	import {
		checkNewDirectoryStatus,
		importLegacyFiles,
		importNewDirectory,
		removeDirectory,
		replaceDirectories,
		rescanDirectory,
	} from '$lib/library/scan-actions/directories.ts'
	import type { Directory } from '$lib/library/types.ts'
	import { useJellyfinSyncService } from '$lib/library/jellyfin-sync.svelte.ts'
	import { useJellyfinStore } from '$lib/stores/jellyfin.svelte.ts'
	import type { DirectoryWithCount } from '../+page.ts'

	interface Props {
		disabled: boolean
		directories: DirectoryWithCount[]
	}

	const { disabled, directories }: Props = $props()

	interface ReparentDirectory {
		childDirs: Directory[]
		newDirHandle: FileSystemDirectoryHandle
	}

	const isAndroidPlatform = isAndroid()
	let reparentDirectory = $state<ReparentDirectory | null>(null)
	const jellyfinSync = useJellyfinSyncService()
	const jellyfinStore = useJellyfinStore()

	const addNewDirectoryHandler = async () => {
		const directory = await showDirectoryPicker({
			mode: 'read',
		})

		let childDirectories: Directory[] = []
		for (const existingDir of directories) {
			if ('legacy' in existingDir || 'jellyfin' in existingDir) {
				continue
			}

			const result = await checkNewDirectoryStatus(existingDir, directory)
			if (result?.status === 'existing') {
				snackbar({
					id: 'directory-already-included',
					message: `Directory '${directory.name}' is already included`,
				})

				return
			}

			if (result?.status === 'child') {
				snackbar({
					id: 'directory-added',
					message: m.directoryIsIncludedInParent({
						existingDir: existingDir.handle.name,
						newDir: directory.name,
					}),
				})

				return
			}

			if (result) {
				childDirectories.push(result.existingDir)
			}
		}

		if (childDirectories.length > 0) {
			reparentDirectory = {
				childDirs: childDirectories,
				newDirHandle: directory,
			}
		} else {
			void importNewDirectory(directory)
		}
	}

	const importLegacyFilesHandler = async () => {
		const files = await getFilesFromLegacyDirectory().catch((e): File[] => {
			snackbar.unexpectedError(e)

			return []
		})

		if (files.length === 0) {
			return
		}

		await importLegacyFiles(files)
	}

	const logoutJellyfin = () => {
		jellyfinStore.logout()
		// Logic to clear Jellyfin tracks from DB would be good here,
		// but for now they will just disappear from the list on next refresh.
	}
</script>

{#snippet addButton(title: string, onclick: () => void)}
	<button
		{@attach ripple()}
		type="button"
		class={[
			disabled ? 'bg-surfaceContainer/10 text-onSurface/54' : 'interactable',
			'flex h-16 items-center gap-2 rounded-sm px-4 ring-1 ring-outlineVariant ring-inset',
		]}
		{disabled}
		{onclick}
	>
		<Icon type="plus" />
		{title}
	</button>
{/snippet}

<ul class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2">
	{#each directories as dir}
		{@const isJellyfin = 'jellyfin' in dir}
		{@const isLegacy = 'legacy' in dir}
		<li
			class={[
				'flex h-16 items-center gap-2 rounded-sm pr-1 pl-4 text-onTertiaryContainer',
				isLegacy ? 'bg-tertiaryContainer/40' : (isJellyfin ? 'bg-primaryContainer/30' : 'bg-tertiaryContainer/56'),
			]}
		>
			{#if isLegacy}
				<div {@attach tooltip(m.settingsTracksInAppStorageTooltip())}>
					<Icon type="information" class="size-4 text-onTertiaryContainer/54" />
				</div>
			{:else if isJellyfin}
				<Icon type="album" class="size-4 text-primary" />
			{/if}

			<div class="flex flex-col overflow-hidden">
				<div class="truncate font-medium">
					{#if isLegacy}
						{m.settingsTracksInsideAppMemory()}
					{:else if isJellyfin}
						{dir.serverName} (Jellyfin)
					{:else}
						{dir.handle.name}
					{/if}
				</div>
				<div class="text-body-sm opacity-70">
					{m.settingsDirectoriesTracksCount({ count: dir.count })}
				</div>
			</div>

			<div class="ml-auto flex items-center gap-1">
				{#if isJellyfin}
					<IconButton
						disabled={disabled || jellyfinSync.isSyncing}
						icon="cached"
						tooltip="Sync now"
						onclick={() => {
							void jellyfinSync.syncAll()
						}}
					/>
					<IconButton
						{disabled}
						icon="logout"
						tooltip={m.jellyfinLogout()}
						onclick={logoutJellyfin}
					/>
				{:else}
					<!-- Chromium on Android broke persisted handles https://issues.chromium.org/issues/499064852 -->
					{#if !(isLegacy || isAndroidPlatform)}
						<IconButton
							{disabled}
							icon="cached"
							tooltip={m.settingsDirRescan()}
							onclick={() => {
								void rescanDirectory((dir as any).id, (dir as any).handle)
							}}
						/>
					{/if}
					<IconButton
						{disabled}
						icon="trashOutline"
						tooltip={m.settingsDirRemove()}
						onclick={() => {
							void removeDirectory((dir as any).id)
						}}
					/>
				{/if}
			</div>
		</li>
	{/each}
	<li class="contents">
		{#if isFileSystemAccessSupported}
			{@render addButton(m.settingsAddDirectory(), addNewDirectoryHandler)}
		{:else}
			{@render addButton(m.settingsImportTracks(), importLegacyFilesHandler)}
		{/if}
	</li>
</ul>

{#snippet directoryName(name: string | undefined)}
	<span class="inline-flex h-[--spacing(4.125)] w-fit items-center gap-1 text-tertiary">
		<Icon type="folder" class="mt-0.5 size-3" />

		<span class="inline h-full w-fit max-w-25 truncate">{name}</span>
	</span>
{/snippet}

<CommonDialog
	open={{
		get: () => reparentDirectory,
		close: () => {
			reparentDirectory = null
		},
	}}
	class="[--dialog-width:--spacing(85)]"
	icon="folderHidden"
	title={m.replaceDirectoryQ()}
	buttons={(data) => [
		{
			title: m.cancel(),
		},
		{
			title: m.replace(),
			action: () => {
				const ids = data.childDirs.map((dir) => dir.id)
				void replaceDirectories(data.newDirHandle, ids)
			},
		},
	]}
>
	{#snippet children({ data })}
		<WrapTranslation messageFn={m.replaceDirectoryExplanation}>
			{#snippet existingDirs()}
				{#each data.childDirs as dir}
					{@render directoryName(dir.handle.name)}
				{/each}
			{/snippet}
			{#snippet newDir()}
				{@render directoryName(data.newDirHandle.name)}
			{/snippet}
		</WrapTranslation>
	{/snippet}
</CommonDialog>
