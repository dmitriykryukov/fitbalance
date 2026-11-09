import { m } from '#lib/paraglide/messages.js';
import {
	FoodParseV1,
	type FoodParseRequest,
	type FoodParseResult,
	type MyFoodMatch
} from '#lib/schemas/food-parse.js';
import { ApiError } from '../api.js';
import { unwrap } from '../db.js';
import type { SupabaseServerClient } from '../supabase.js';
import { buildFoodParseResult, foodKey } from './food-parse-result.js';
import { AI_SETTINGS, getAIProvider } from './index.js';
import { FOOD_PARSER_SYSTEM, foodParserUserMessage } from './prompts/food-parser.js';
import { AIError, type AIErrorKind } from './provider.js';
import { assertWithinDailyLimit, logUsage, type UsageStatus } from './rate-limit.js';

const USAGE_STATUS: Record<AIErrorKind, UsageStatus> = {
	rate_limited: 'rate_limited',
	timeout: 'timeout',
	provider: 'provider_error',
	refused: 'invalid_response',
	invalid: 'invalid_response',
	config: 'provider_error'
};

/** AIError → the API error envelope (AI_SPEC.md → Error mapping). */
export function aiApiError(error: AIError): Error {
	switch (error.kind) {
		case 'rate_limited':
			return new ApiError('RATE_LIMITED', m.ai_error_busy(), undefined, error.retryAfterSeconds);
		case 'timeout':
		case 'provider':
			return new ApiError('AI_PROVIDER_ERROR', m.ai_error_provider());
		case 'refused':
			return new ApiError('AI_REFUSED', m.ai_error_refused());
		case 'invalid':
			return new ApiError('AI_INVALID_RESPONSE', m.ai_error_invalid());
		case 'config':
			// A setup problem, not the user's: INTERNAL_ERROR, details in the server log.
			return new Error(`[ai] configuration: ${error.message}`);
	}
}

/** Characters that would act as wildcards or break PostgREST quoting. */
const UNSAFE_NAME = /[\\%_*"]/;

/**
 * My foods with the same (case-insensitive) name as the parsed items. When
 * several saved foods share a name (different brands), the most used wins.
 */
async function findMyFoods(
	sb: SupabaseServerClient,
	userId: string,
	names: string[]
): Promise<Map<string, MyFoodMatch>> {
	const unique = [...new Set(names.map((n) => n.trim()))].filter((n) => n && !UNSAFE_NAME.test(n));
	const matches = new Map<string, MyFoodMatch>();
	if (unique.length === 0) return matches;

	// ilike without wildcards is a case-insensitive equality test.
	const filter = unique.map((n) => `name.ilike."${n}"`).join(',');
	const rows =
		unwrap(
			await sb
				.from('food_items')
				.select(
					'id, name, brand, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fibre_per_100g'
				)
				.eq('user_id', userId)
				.or(filter)
				.order('use_count', { ascending: false })
				.order('last_used_at', { ascending: false, nullsFirst: false })
				.limit(100)
		) ?? [];

	for (const row of rows) {
		const key = foodKey(row.name);
		if (matches.has(key)) continue;
		matches.set(key, {
			id: row.id,
			name: row.name,
			brand: row.brand,
			nutrition_per_100g: {
				kcal: row.kcal_per_100g,
				protein_g: row.protein_per_100g,
				carbs_g: row.carbs_per_100g,
				fat_g: row.fat_per_100g,
				fibre_g: row.fibre_per_100g
			}
		});
	}
	return matches;
}

/**
 * POST /api/ai/food-parse pipeline (AI_SPEC.md). Checks the daily limit,
 * asks the model for schema v1, validates it, adds warnings, My foods
 * matches and preview totals, and logs one `ai_usage` row. Saves nothing
 * else: the meal text is not stored unless the user saves the meal.
 */
export async function parseFoodDescription(
	sb: SupabaseServerClient,
	userId: string,
	input: FoodParseRequest,
	locale: 'en' | 'ru'
): Promise<FoodParseResult> {
	const settings = AI_SETTINGS.food_parse;
	await assertWithinDailyLimit(sb, userId, 'food_parse', settings.dailyLimit);

	let parsed: FoodParseV1;
	try {
		const { data, usage } = await getAIProvider().generateStructured({
			system: FOOD_PARSER_SYSTEM,
			messages: [{ role: 'user', content: foodParserUserMessage(input, locale) }],
			schema: FoodParseV1,
			model: settings.model,
			effort: settings.effort,
			maxTokens: settings.maxTokens,
			timeoutMs: settings.timeoutMs
		});
		await logUsage(sb, userId, 'food_parse', usage, 'ok');
		parsed = data;
	} catch (error) {
		if (!(error instanceof AIError)) throw error;
		if (error.usage) {
			await logUsage(sb, userId, 'food_parse', error.usage, USAGE_STATUS[error.kind]);
		}
		if (error.kind !== 'config') {
			console.warn(`[ai] food_parse ${error.kind}: ${error.message}`);
		}
		throw aiApiError(error);
	}

	const matches = await findMyFoods(
		sb,
		userId,
		parsed.items.map((item) => item.name)
	);
	return buildFoodParseResult(parsed, matches);
}
