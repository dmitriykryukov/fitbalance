import type { RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, authed, noContent, ok, parseBody, parseQuery } from './api.js';

const jsonRequest = (body: string, type = 'application/json') =>
	new Request('http://localhost/api/test', {
		method: 'POST',
		headers: { 'content-type': type },
		body
	});

function fakeEvent(user: { id: string; email: string | null } | null): RequestEvent {
	return {
		request: new Request('http://localhost/api/test'),
		url: new URL('http://localhost/api/test'),
		locals: { getUser: async () => user }
	} as unknown as RequestEvent;
}

const Schema = z.strictObject({ grams: z.number().positive(), name: z.string().min(1) });

describe('parseBody', () => {
	it('returns validated data', async () => {
		await expect(parseBody(jsonRequest('{"grams":100,"name":"Egg"}'), Schema)).resolves.toEqual({
			grams: 100,
			name: 'Egg'
		});
	});

	it('rejects non-JSON content types', async () => {
		await expect(parseBody(jsonRequest('grams=1', 'text/plain'), Schema)).rejects.toMatchObject({
			code: 'VALIDATION_ERROR'
		});
	});

	it('rejects malformed JSON', async () => {
		await expect(parseBody(jsonRequest('{oops'), Schema)).rejects.toMatchObject({
			code: 'VALIDATION_ERROR',
			fields: { _: 'Malformed JSON' }
		});
	});

	it('reports each invalid field by path', async () => {
		const err = await parseBody(jsonRequest('{"grams":0,"name":""}'), Schema).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(Object.keys(err.fields).sort()).toEqual(['grams', 'name']);
	});

	it('rejects unknown fields such as a client-supplied user_id', async () => {
		const err = await parseBody(
			jsonRequest('{"grams":1,"name":"Egg","user_id":"someone-else"}'),
			Schema
		).catch((e) => e);
		expect(err.code).toBe('VALIDATION_ERROR');
	});
});

describe('parseQuery', () => {
	it('validates search params', () => {
		const url = new URL('http://localhost/api/meals?date=2026-11-07');
		expect(parseQuery(url, z.object({ date: z.iso.date() }))).toEqual({ date: '2026-11-07' });
		expect(() =>
			parseQuery(new URL('http://localhost/api/meals?date=nope'), z.object({ date: z.iso.date() }))
		).toThrow(ApiError);
	});
});

describe('authed', () => {
	afterEach(() => vi.restoreAllMocks());

	it('returns 401 UNAUTHENTICATED without a verified user', async () => {
		const handler = authed(() => ok({ secret: true }));
		const res = await handler(fakeEvent(null));
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ data: null, error: { code: 'UNAUTHENTICATED' } });
	});

	it('passes the verified user to the handler', async () => {
		const handler = authed(({ user }) => ok({ id: user.id }));
		const res = await handler(fakeEvent({ id: 'u1', email: null }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ data: { id: 'u1' }, error: null });
	});

	it('maps ApiError to its status and adds retry-after', async () => {
		const handler = authed(() => {
			throw new ApiError('RATE_LIMITED', 'Slow down', undefined, 30);
		});
		const res = await handler(fakeEvent({ id: 'u1', email: null }));
		expect(res.status).toBe(429);
		expect(res.headers.get('retry-after')).toBe('30');
		expect(await res.json()).toMatchObject({
			error: { code: 'RATE_LIMITED', retry_after_seconds: 30 }
		});
	});

	it('hides unexpected error details', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const handler = authed(() => {
			throw new Error('relation "secret_table" does not exist');
		});
		const res = await handler(fakeEvent({ id: 'u1', email: null }));
		const body = await res.json();
		expect(res.status).toBe(500);
		expect(body.error.code).toBe('INTERNAL_ERROR');
		expect(JSON.stringify(body)).not.toContain('secret_table');
	});

	it('returns an empty body for 204', async () => {
		const res = await authed(() => noContent())(fakeEvent({ id: 'u1', email: null }));
		expect(res.status).toBe(204);
		expect(await res.text()).toBe('');
	});
});
