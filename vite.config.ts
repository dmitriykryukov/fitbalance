import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		}),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			emitTsDeclarations: true,
			// No locale in URLs (the app is private). Signed-in users get their
			// profile locale written to this cookie; otherwise the browser language.
			strategy: ['cookie', 'preferredLanguage', 'baseLocale']
		})
	],
	// Matches the Site URL / redirect URLs configured in Supabase Auth.
	server: { port: 5174, strictPort: true },
	preview: { port: 5174, strictPort: true },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				// Talks to the real Supabase project from `.env` (run with --mode integration).
				extends: './vite.config.ts',
				test: {
					name: 'integration',
					environment: 'node',
					include: ['tests/integration/**/*.test.ts'],
					fileParallelism: false,
					testTimeout: 30_000,
					hookTimeout: 60_000
				}
			},
			{
				// Live Claude API calls that cost money: `npm run ai:eval` only (sets RUN_AI_EVAL=1).
				extends: './vite.config.ts',
				test: {
					name: 'eval',
					environment: 'node',
					include: ['tests/eval/**/*.eval.ts'],
					testTimeout: 600_000
				}
			}
		]
	}
});
