<script lang="ts">
	import { browser } from '$app/environment'
	import { navigating, page } from '$app/state'
	import { APP_DIALOGS_COMPONENTS } from '$lib/components/app-dialogs/dialogs.ts'
	import Button from '$lib/components/Button.svelte'
	import Icon from '$lib/components/icon/Icon.svelte'
	import MenuRenderer, { setupGlobalMenu } from '$lib/components/menu/MenuRenderer.svelte'
	import PlayerOverlay from '$lib/components/PlayerOverlay.svelte'
	import SnackbarRenderer from '$lib/components/snackbar/SnackbarRenderer.svelte'
	import { isElementTextInput } from '$lib/helpers/input.ts'
	import { setupOverlaySnippets } from '$lib/layout-bottom-bar.svelte'
	import { DialogsStore } from '$lib/stores/dialogs/store.svelte.ts'
	import { setDialogsStoreContext } from '$lib/stores/dialogs/use-store.ts'
	import { MainStore } from '$lib/stores/main/store.svelte.ts'
	import { setMainStoreContext } from '$lib/stores/main/use-store.ts'
	import { PlayerStore } from '$lib/stores/player/player.svelte.ts'
	import { setPlayerStoreContext } from '$lib/stores/player/use-store.ts'
	import { onViewTransitionPrepare, setupAppViewTransitions } from '$lib/view-transitions.svelte.ts'
	import { setupAppInstallPromptListeners } from './layout/app-install-prompt.ts'
	import {
		type DirectoriesPermissionPromptSnackbarArg,
		setupDirectoriesPermissionPrompt,
	} from './layout/setup-directories-permission-prompt.svelte.ts'
	import { setupTheme } from './layout/setup-theme.svelte.ts'
	import { useJellyfinStore } from '$lib/stores/jellyfin.svelte.ts'
	import { reportJellyfinSession } from '$lib/library/jellyfin-adapter.ts'
	import { useJellyfinSyncService } from '$lib/library/jellyfin-sync.svelte.ts'

	// These context are in different files from their implementation
	// to allow better trees shaking and inlining
	const mainStore = setMainStoreContext(new MainStore())
	const player = setPlayerStoreContext(new PlayerStore())
	setDialogsStoreContext(new DialogsStore())

	setupTheme()
	setupGlobalMenu()
	setupAppViewTransitions(() => mainStore.isReducedMotion)
	setupAppInstallPromptListeners()
	const overlaySnippets = setupOverlaySnippets()

	const { children } = $props()

	let overlayContentHeight = $state(0)

	onViewTransitionPrepare(async ({ to }) => {
		if (to?.route.id === '/(app)/player' || to?.route.id === '/(app)/library/[[slug=libraryEntities]]/[uuid]') {
			document.documentElement.classList.add('transition-player-expand')
		} else {
			document.documentElement.classList.remove('transition-player-expand')
		}
	})

	$effect(() => {
		if (navigating.to) {
			const isPlayer = navigating.to.url.pathname === '/player'
			const isNotTextInput = !isElementTextInput(document.activeElement)

			if (!isPlayer && isNotTextInput) {
				// Prevent focus from being lost when navigating
				// but only if it's not a text input
				;(document.activeElement as HTMLElement | null)?.blur()
			}
		}
	})

	$effect(() => {
		const isPlayerPage = page.url.pathname === '/player'

		document.documentElement.classList.toggle('is-player-page', isPlayerPage)
	})

	$effect(() => {
		const bottomBar = document.querySelector('.bottom-bar-container')
		if (bottomBar) {
			const rect = bottomBar.getBoundingClientRect()

			const setProperty = (name: 'left' | 'bottom' | 'width' | 'height') => {
				document.documentElement.style.setProperty(`--mp-${name}`, `${rect[name]}px`)
			}

			setProperty('left')
			setProperty('bottom')
			setProperty('width')
			setProperty('height')
		}
	})

	if (browser) {
		void setupDirectoriesPermissionPrompt(directoriesPermissionSnackbar)
	}

	$effect(() => {
		if (browser) {
			const jellyfin = useJellyfinStore()
			if (jellyfin.isLoggedIn) {
				void reportJellyfinSession()
				void useJellyfinSyncService().syncAll()
			}
		}
	})
</script>

{#snippet directoriesPermissionSnackbar({ dirs, dismiss }: DirectoriesPermissionPromptSnackbarArg)}
	<div class="flex w-full flex-col gap-1 pt-2 pb-1">
		<div>
			<div>{m.libraryDirPromptBrowserPermission()}</div>
			<div class="text-body-sm opacity-54">
				{m.libraryDirPromptExplanation()}
			</div>
		</div>

		<!-- Showing only subset at the time so snackbar does not take up the whole screen -->
		{#each dirs().slice(0, 3) as dir}
			<div class="flex items-center gap-4 py-2">
				<div class="truncate text-body-sm opacity-54">
					{dir.path}
				</div>

				<Button
					kind="toned"
					class="ml-auto"
					onclick={async () => {
						const granted = await dir.requestPermission()
						if (granted) {
							dismiss()
						}
					}}
				>
					{m.libraryDirPromptGrant()}
				</Button>
			</div>
		{/each}
	</div>
{/snippet}

<div class="bg-surface text-onSurface selection:bg-primary/30 selection:text-primary">
	{@render children()}

	<PlayerOverlay bind:contentHeight={overlayContentHeight} />

	<SnackbarRenderer />

	<div
		class="bottom-bar-container fixed right-0 bottom-0 left-0 z-50 flex flex-col justify-end pointer-events-none"
	>
		<div class="pointer-events-auto">
			{#each overlaySnippets.abovePlayer as snippet}
				{@render snippet()}
			{/each}
			
			{#if overlaySnippets.bottomBar}
				{@render overlaySnippets.bottomBar()}
			{/if}
		</div>
	</div>

	<div id="tooltip-container" class="pointer-events-none"></div>

	<MenuRenderer />

	{#each APP_DIALOGS_COMPONENTS as DialogComponent}
		<DialogComponent />
	{/each}
</div>

<style lang="postcss">
	@reference '../../app.css';

	.bottom-bar-container {
		height: var(--mp-height);
		transition: height 300ms var(--ease-standard);

		:global(.is-player-page) & {
			height: 0;
		}
	}

	:global(::view-transition-new(bottom-bar):only-child) {
		/* Svelte 5 currently have issue with view transition
		   not being able to distinguish between 'none' and 'auto'
		   for animation-name, so we need to manually set it to 
		   something else to prevent 'fade' from being used.
		*/
		animation: view-bottom-bar-in 300ms var(--ease-standard) forwards;
	}

	:global(::view-transition-old(bottom-bar):only-child) {
		animation: view-bottom-bar-out 300ms var(--ease-standard) forwards;
	}
</style>
