<script lang="ts">
	import { tooltip } from '$lib/attachments/tooltip.ts'
	import Button from '$lib/components/Button.svelte'
	import IconButton from '$lib/components/IconButton.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import Select from '$lib/components/Select.svelte'
	import Separator from '$lib/components/Separator.svelte'
	import Slider from '$lib/components/Slider.svelte'
	import Spinner from '$lib/components/Spinner.svelte'
	import Switch from '$lib/components/Switch.svelte'
	import TextField from '$lib/components/TextField.svelte'
	import { isDatabaseOperationPending } from '$lib/db/lock-database.ts'
	import { initPageQueries } from '$lib/db/query/page-query.svelte.ts'
	import { supportsChangingAudioVolume } from '$lib/helpers/audio.ts'
	import { Debounced } from '$lib/helpers/debounced.svelte.ts'
	import { isFileSystemAccessSupported } from '$lib/helpers/file-system.ts'
	import { debounce } from '$lib/helpers/utils/debounce.ts'
	import { isMobile } from '$lib/helpers/utils/ua.ts'
	import type { AppMotionOption, AppThemeOption } from '$lib/stores/main/store.svelte.ts'
	import { useJellyfinStore } from '$lib/stores/jellyfin.svelte.ts'
	import {
		PLAYER_PLAYBACK_RATE_MAX,
		PLAYER_PLAYBACK_RATE_MIN,
	} from '$lib/stores/player/player.svelte.ts'
	import { getLocale, type Locale, setLocale } from '$paraglide/runtime.js'
	import DirectoriesList from './components/DirectoriesList.svelte'
	import InstallAppBanner from './components/InstallAppBanner.svelte'
	import MissingFsApiBanner from './components/MissingFsApiBanner.svelte'

	const { data } = $props()

	// svelte-ignore state_referenced_locally
	initPageQueries(data)

	const mainStore = useMainStore()
	const player = usePlayer()
	const dialogs = useDialogsStore()
	const jellyfin = useJellyfinStore()

	const directories = $derived(data.directoriesQuery.value)

	const themeOptions: { name: string; value: AppThemeOption }[] = [
		{
			name: m.settingsThemeAuto(),
			value: 'auto',
		},
		{
			name: m.settingsThemeDark(),
			value: 'dark',
		},
		{
			name: m.settingsThemeLight(),
			value: 'light',
		},
	]

	const motionOptions: { name: string; value: AppMotionOption }[] = [
		{
			name: m.settingsMotionAuto(),
			value: 'auto',
		},
		{
			name: m.settingsMotionReduced(),
			value: 'reduced',
		},
		{
			name: m.settingsMotionNormal(),
			value: 'normal',
		},
	]

	const languageOptions: { name: string; value: Locale }[] = [
		{ name: 'English (EN)', value: 'en' },
		{ name: 'Lietuvių (LT)', value: 'lt' },
		{ name: 'Deutsch (DE)', value: 'de' },
		{ name: 'Français (FR)', value: 'fr' },
		{ name: '简体中文', value: 'zh-CN' },
		{ name: '繁體中文', value: 'zh-TW' },
	]

	const bitrateOptions = [
		{ value: 64, label: '64 kbps' },
		{ value: 96, label: '96 kbps' },
		{ value: 128, label: '128 kbps' },
		{ value: 192, label: '192 kbps' },
		{ value: 256, label: '256 kbps' },
		{ value: 320, label: '320 kbps' },
	]

	const contentViewOptions = [
		{ value: 'grid', label: 'Grid' },
		{ value: 'list', label: 'List' },
	]

	const updateMainColor = debounce((value: string | null) => {
		mainStore.customThemePaletteHex = value
	}, 400)

	// We debounce state updates, because some DB operations can be very fast.
	// This prevents UI from flickering
	const isDatabasePendingGetter = new Debounced(() => isDatabaseOperationPending(), 200)
	const isDatabasePending = $derived(isDatabasePendingGetter.current)
</script>

{#snippet heading(text: string)}
	<div class="px-4 pt-4 text-title-sm text-onSurfaceVariant">{text}</div>
{/snippet}

<section class="card settings-max-width mx-auto w-full overflow-clip">
	<div class="flex flex-col p-4">
		<div class="flex items-center gap-2 text-title-sm">
			{m.settingsDirectories()}
		</div>
		<div class="mt-1 mb-4 text-body-sm text-onSurfaceVariant">
			{m.settingsAllDataLocal()}
		</div>

		{#if !isFileSystemAccessSupported}
			<MissingFsApiBanner />
		{/if}
		<DirectoriesList disabled={isDatabasePending} {directories} />

		{#if isDatabasePending}
			<div
				class="mt-4 flex w-full items-center justify-center gap-4 rounded-md bg-tertiaryContainer/20 py-4"
			>
				{m.settingsDbOperationInProgress()}
				<Spinner class="size-8" />
			</div>
		{/if}
	</div>

	{#if jellyfin.isLoggedIn}
		<Separator />
		{@render heading(m.jellyfinSettings())}
		<div class="flex flex-col gap-4 p-4">
			<div class="flex items-center justify-between gap-4">
				<div class="flex flex-col">
					<div>{m.jellyfinTranscode()}</div>
					<div class="text-body-sm opacity-54">Useful for slow connections</div>
				</div>
				<Switch bind:checked={jellyfin.shouldTranscode} />
			</div>

			{#if jellyfin.shouldTranscode}
				<div class="flex items-center justify-between gap-4">
					<div>{m.jellyfinTranscodeBitrate()}</div>
					<Select
						items={bitrateOptions}
						key="value"
						labelKey="label"
						bind:selected={jellyfin.transcodeBitrate}
						class="w-32"
					/>
				</div>
			{/if}

			<div class="flex items-center justify-between gap-4">
				<div>{m.jellyfinContentView()}</div>
				<Select
					items={contentViewOptions}
					key="value"
					labelKey="label"
					bind:selected={jellyfin.contentViewType}
					class="w-32"
				/>
			</div>

			<div class="flex items-center justify-between gap-4">
				<div>{m.jellyfinHideDuplicateArtists()}</div>
				<Switch bind:checked={jellyfin.hideSongArtistsIfSameAsAlbum} />
			</div>

			<div class="flex items-center justify-between gap-4">
				<div>{m.jellyfinShuffleLimit()}</div>
				<div class="flex w-32 items-center gap-2">
					<TextField
						name="shuffleLimit"
						type="text"
						bind:value={jellyfin.songShuffleItemCount}
					/>
				</div>
			</div>
		</div>
	{/if}

	<Separator />

	{@render heading(m.settingsAppearance())}

	<div class="flex flex-col gap-4 p-4">
		<div class="flex items-center justify-between gap-4">
			<div>{m.settingsApplicationTheme()}</div>
			<Select
				items={themeOptions}
				key="value"
				labelKey="name"
				bind:selected={mainStore.theme}
				class="w-32"
			/>
		</div>

		<div class="flex items-center justify-between gap-4">
			<div class="flex flex-col">
				<div>{m.settingsPrimaryColor()}</div>
				<div class="text-body-sm opacity-54">
					{m.settingPickColorFromArtwork()}
				</div>
			</div>

			<div class="flex items-center gap-4">
				{#if !mainStore.pickColorFromArtwork}
					<input
						type="color"
						class="h-10 w-10 appearance-none overflow-hidden rounded-full border-none p-0"
						value={mainStore.customThemePaletteHex ?? '#000000'}
						oninput={(e) => updateMainColor(e.currentTarget.value)}
					/>
				{/if}
				<Switch bind:checked={mainStore.pickColorFromArtwork} />
			</div>
		</div>

		<div class="flex items-center justify-between gap-4">
			<div>Split layout enabled</div>
			<Switch bind:checked={mainStore.librarySplitLayoutEnabled} />
		</div>

		<div class="flex items-center justify-between gap-4">
			<div>{m.settingsMotion()}</div>
			<Select
				items={motionOptions}
				key="value"
				labelKey="name"
				bind:selected={mainStore.motion}
				class="w-32"
			/>
		</div>

		<div class="flex items-center justify-between gap-4">
			<div>{m.settingsLanguage()}</div>
			<Select
				items={languageOptions}
				key="value"
				labelKey="name"
				selected={getLocale()}
				onselected={(value) => setLocale(value)}
				class="w-32"
			/>
		</div>
	</div>

	<Separator />

	{@render heading(m.settingsAudio())}

	<div class="flex flex-col gap-4 p-4">
		{#if supportsChangingAudioVolume}
			<div class="flex items-center justify-between gap-4">
				<div>{m.settingsDisplayVolumeSlider()}</div>
				<Switch bind:checked={mainStore.volumeSliderEnabled} />
			</div>
		{/if}

		<div class="flex flex-col gap-1">
			<div>{m.settingsPlaybackSpeed()}</div>
			<div class="flex items-center gap-4">
				<Slider
					class="w-full"
					min={PLAYER_PLAYBACK_RATE_MIN}
					max={PLAYER_PLAYBACK_RATE_MAX}
					step={0.1}
					bind:value={player.playbackRate}
				/>
				<div class="w-10 text-right tabular-nums">{player.playbackRate.toFixed(1)}x</div>
				<IconButton
					icon="refresh"
					tooltip={m.settingsPlaybackSpeedReset()}
					onclick={() => (player.playbackRate = 1)}
				/>
			</div>
		</div>

		<div class="flex items-center justify-between gap-4">
			<div class="flex flex-col">
				<div>{m.settingsPreservePitch()}</div>
				<div class="text-body-sm opacity-54">
					{m.settingsPreservePitchInfo()}
				</div>
			</div>
			<Switch bind:checked={player.preservePitch} />
		</div>

		<div class="flex items-center justify-between gap-4">
			<div>{m.equalizerTitle()}</div>
			<IconButton
				icon="chevronRight"
				tooltip={m.equalizerTitle()}
				onclick={() => (dialogs.equalizerDialogOpen = true)}
			/>
		</div>
	</div>

	<Separator />

	<div class="flex flex-col gap-1 p-4">
		<InstallAppBanner />

		<Button as="a" href="/about" tooltip={m.about()} icon="chevronRight">
			{m.about()}
		</Button>
	</div>
</section>

<style lang="postcss">
	@reference '../../../../app.css';

	:global(.settings-max-width) {
		max-width: --spacing(225);
	}
</style>
