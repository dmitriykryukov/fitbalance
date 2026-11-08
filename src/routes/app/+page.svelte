<script lang="ts">
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import ComingSoon from '#lib/components/shared/ComingSoon.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<PageHeader title={m.today_title()} />
<ComingSoon phase={2} />
