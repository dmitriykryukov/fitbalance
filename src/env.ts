import { defineEnvVars } from '@sveltejs/kit/env';

/** Returns the value, or throws with a clear message when it is missing. */
const required = (hint: string) => (value: string | undefined) => {
	if (!value) throw new Error(`Missing environment variable. ${hint}`);
	return value;
};

const optionalString = (value: string | undefined) => value || undefined;

const withDefault = (fallback: string) => (value: string | undefined) => value || fallback;

const positiveInt = (fallback: number) => (value: string | undefined) => {
	if (!value) return fallback;
	const n = Number(value);
	if (!Number.isInteger(n) || n < 0)
		throw new Error(`Expected a non-negative integer, got "${value}"`);
	return n;
};

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		description: 'Supabase project URL, e.g. https://<ref>.supabase.co',
		schema: (value) => {
			const url = required('Set PUBLIC_SUPABASE_URL in .env (see .env.example).')(value);
			new URL(url); // throws on malformed URLs
			return url;
		}
	},
	PUBLIC_SUPABASE_ANON_KEY: {
		public: true,
		description: 'Supabase publishable (anon) key. Safe for the browser; RLS protects the data.',
		schema: required('Set PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example).')
	},
	SUPABASE_SERVICE_ROLE_KEY: {
		description: 'Supabase secret key. Server only; used for account deletion.',
		schema: optionalString
	},
	ANTHROPIC_API_KEY: {
		description: 'Claude API key. Server only; needed from Phase 3 (AI food parser).',
		schema: optionalString
	},
	AI_FOOD_PARSER_MODEL: {
		description: 'Model for the AI food parser',
		schema: withDefault('claude-haiku-5-5')
	},
	AI_COACH_MODEL: {
		description: 'Model for the AI Coach',
		schema: withDefault('claude-sonnet-5-5')
	},
	AI_DAILY_INSIGHT_MODEL: {
		description: 'Model for the daily insight card',
		schema: withDefault('claude-haiku-5-5')
	},
	AI_DAILY_FOOD_PARSE_LIMIT: {
		description: 'Food parses per user per 24 h',
		schema: positiveInt(50)
	},
	AI_DAILY_COACH_LIMIT: {
		description: 'Coach messages per user per 24 h',
		schema: positiveInt(30)
	}
});
