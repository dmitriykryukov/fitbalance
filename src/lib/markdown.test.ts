import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown } from './markdown.js';

const plain = (text: string) => ({ text, bold: false, italic: false });

describe('parseInline', () => {
	it('splits bold and italic spans', () => {
		expect(parseInline('Eat **more protein** at *breakfast* today')).toEqual([
			plain('Eat '),
			{ text: 'more protein', bold: true, italic: false },
			plain(' at '),
			{ text: 'breakfast', bold: false, italic: true },
			plain(' today')
		]);
	});

	it('leaves lone asterisks and maths alone', () => {
		expect(parseInline('2 * 3 = 6')).toEqual([plain('2 * 3 = 6')]);
	});
});

describe('parseMarkdown', () => {
	it('groups paragraphs, bullet and numbered lists', () => {
		const blocks = parseMarkdown(
			'You logged 3 of 7 days.\nAverage 1,850 kcal.\n\n- Protein: 95 g\n* Fat: 60 g\n\n1. Add eggs\n2. Walk 20 min'
		);
		expect(blocks.map((b) => b.type)).toEqual(['p', 'ul', 'ol']);
		expect(blocks[0]).toEqual({
			type: 'p',
			lines: [[plain('You logged 3 of 7 days.')], [plain('Average 1,850 kcal.')]]
		});
		expect(blocks[1]).toMatchObject({
			type: 'ul',
			items: [[plain('Protein: 95 g')], [plain('Fat: 60 g')]]
		});
		expect(blocks[2]).toMatchObject({ type: 'ol', start: 1 });
	});

	it('turns headings into bold paragraphs and keeps raw HTML as text', () => {
		const blocks = parseMarkdown('## Summary\n<img src=x onerror=alert(1)>');
		expect(blocks[0]).toEqual({
			type: 'p',
			lines: [[{ text: 'Summary', bold: true, italic: false }]]
		});
		expect(blocks[1]).toEqual({ type: 'p', lines: [[plain('<img src=x onerror=alert(1)>')]] });
	});

	it('continues a list item on an indented line', () => {
		const [list] = parseMarkdown('- Protein was low\n  on 3 days');
		expect(list).toEqual({ type: 'ul', items: [[plain('Protein was low'), plain(' on 3 days')]] });
	});
});
