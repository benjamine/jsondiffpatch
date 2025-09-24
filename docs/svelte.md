# How to render in svelte

Here is an example of a reusable component for svelte 5:

```svelte
<script lang="ts">
	import { create } from 'jsondiffpatch';
	import { format as formatHtml } from 'jsondiffpatch/formatters/html';
	import 'jsondiffpatch/formatters/styles/html.css';

	let {
		left,
		right,
		diffOptions = undefined,
		hideUnchangedValues = false,
	}: {
		left: unknown;
		right: unknown;
		diffOptions?: Parameters<typeof create>[0] | undefined;
		hideUnchangedValues?: boolean;
	} = $props();

	let htmlDiff = $derived.by(() => {
		const jdp = create(diffOptions ?? {});
		const delta = jdp.diff(left, right);
		return formatHtml(delta, left);
	});
</script>

<div class={`json-diff-container ${hideUnchangedValues ? 'jsondiffpatch-unchanged-hidden' : ''}`}>
	<div class="jsondiffpatch-result" aria-label="Visual JSON diff">
		{@html htmlDiff}
	</div>
</div>
```
