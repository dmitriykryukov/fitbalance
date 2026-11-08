<script lang="ts">
	import PageHeader from '#lib/components/layout/PageHeader.svelte';
	import Card from '#lib/components/shared/Card.svelte';
	import ComingSoon from '#lib/components/shared/ComingSoon.svelte';
	import LanguageSwitch from '#lib/components/shared/LanguageSwitch.svelte';
	import { m } from '#lib/paraglide/messages.js';
</script>

<PageHeader title={m.profile_title()} />
<div class="mb-4 px-4">
	<Card>
		<LanguageSwitch />
	</Card>
</div>
<ComingSoon phase={1} />
