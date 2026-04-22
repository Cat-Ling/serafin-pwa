<script lang="ts" module>
	import VirtualContainer from '$lib/components/VirtualContainer.svelte'
	import { safeInteger } from '$lib/helpers/utils/integers.ts'
	import { isMobile } from '$lib/helpers/utils/ua.ts'
	import { useJellyfinStore } from '$lib/stores/jellyfin.svelte.ts'
	import LibraryGridItem, {
		type LibraryGridItemType,
		type LibraryItemGridItemProps,
	} from './LibraryGridItem.svelte'

	interface Props<Type extends LibraryGridItemType> {
		type: Type
		items: readonly number[]
		item: LibraryItemGridItemProps<Type>['children']
	}
</script>

<script lang="ts" generics="Type extends LibraryGridItemType">
	const { items, type, item: itemSnippet }: Props<Type> = $props()

	const jellyfin = useJellyfinStore()

	let containerWidth = $state(0)

	const gap = 8

	const sizes = $derived.by(() => {
		let columns: number
		
		if (jellyfin.isLoggedIn) {
			columns = isMobile() ? jellyfin.gridColumnsPortrait : jellyfin.gridColumnsLandscape
		} else {
			const minWidth = containerWidth > 600 ? 180 : 140
			columns = safeInteger(Math.floor(containerWidth / minWidth), 1)
		}

		const width = safeInteger(Math.floor((containerWidth - gap * (columns - 1)) / columns))

		const height = width + 72

		return {
			width,
			height: height + gap,
			columns,
			heightWithoutGap: height,
		}
	})
</script>

<VirtualContainer
	{items}
	{sizes}
	bind:width={containerWidth}
	padding={8}
	class="grid-list-container"
>
	{#snippet children(item)}
		<LibraryGridItem
			itemId={item.value}
			{type}
			style="
				width: {item.width}px;
				height: {item.heightWithoutGap}px;
				transform: translateX({item.left}px) translateY({item.top}px);
			"
			class="virtual-item top-0"
		>
			{#snippet children(itemValue)}
				{@render itemSnippet(itemValue)}
			{/snippet}
		</LibraryGridItem>
	{/snippet}
</VirtualContainer>
