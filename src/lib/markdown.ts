/**
 * The light Markdown the Coach writes (AI_SPEC.md: plain text, light
 * Markdown): paragraphs, "-"/"*" bullet lists, numbered lists, **bold** and
 * *italic*. Headings become bold paragraphs; anything else stays plain text.
 * Parsed into data and rendered by Svelte, never as HTML, so a reply can't
 * inject markup.
 */

export type Inline = { text: string; bold: boolean; italic: boolean };
export type Line = Inline[];

export type Block =
	| { type: 'p'; lines: Line[] }
	| { type: 'ul'; items: Line[] }
	| { type: 'ol'; start: number; items: Line[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;
const INLINE = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\s][^*\n]*?\*)/g;

/** Splits **bold** and *italic* spans out of one line. */
export function parseInline(text: string, bold = false): Line {
	const parts: Line = [];
	let last = 0;
	for (const match of text.matchAll(INLINE)) {
		const index = match.index ?? 0;
		if (index > last) parts.push({ text: text.slice(last, index), bold, italic: false });
		const token = match[0];
		if (token.startsWith('**') || token.startsWith('__')) {
			parts.push({ text: token.slice(2, -2), bold: true, italic: false });
		} else {
			parts.push({ text: token.slice(1, -1), bold, italic: true });
		}
		last = index + token.length;
	}
	if (last < text.length) parts.push({ text: text.slice(last), bold, italic: false });
	return parts;
}

export function parseMarkdown(source: string): Block[] {
	const blocks: Block[] = [];
	let current: Block | null = null;
	const close = () => {
		if (current) blocks.push(current);
		current = null;
	};

	for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
		const line = raw.trimEnd();
		if (!line.trim()) {
			close();
			continue;
		}
		const bullet = BULLET.exec(line);
		const numbered = NUMBERED.exec(line);
		const heading = HEADING.exec(line);

		if (bullet) {
			if (current?.type !== 'ul') {
				close();
				current = { type: 'ul', items: [] };
			}
			current.items.push(parseInline(bullet[1]));
		} else if (numbered) {
			if (current?.type !== 'ol') {
				close();
				current = { type: 'ol', start: Number(numbered[1]), items: [] };
			}
			current.items.push(parseInline(numbered[2]));
		} else if (heading) {
			close();
			blocks.push({ type: 'p', lines: [parseInline(heading[1].replace(/[*_]/g, ''), true)] });
		} else if (current && current.type !== 'p' && /^\s+/.test(raw)) {
			// An indented line continues the last list item.
			const items = current.items;
			items[items.length - 1] = [...items[items.length - 1], ...parseInline(` ${line.trim()}`)];
		} else {
			if (current?.type !== 'p') {
				close();
				current = { type: 'p', lines: [] };
			}
			current.lines.push(parseInline(line.trim()));
		}
	}
	close();
	return blocks;
}
