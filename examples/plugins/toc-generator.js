/**
 * Table of Contents Generator Plugin
 *
 * Automatically generates a table of contents from markdown headers.
 * Supports customizable depth, titles, and anchor generation.
 *
 * @example
 * ```yaml
 * plugins:
 *   - name: toc-generator
 *     source: ./examples/plugins/toc-generator.js
 *
 * patches:
 *   - op: exec
 *     plugin: toc-generator
 *     params:
 *       maxDepth: 3
 *       title: "Contents"
 *       position: "after-title"
 * ```
 */

export const name = 'toc-generator';
export const version = '1.0.0';
export const description = 'Generates a table of contents from markdown headers';

export const params = [
	{
		name: 'maxDepth',
		type: 'number',
		required: false,
		default: 3,
		description: 'Maximum heading depth to include (1-6)'
	},
	{
		name: 'title',
		type: 'string',
		required: false,
		default: 'Table of Contents',
		description: 'Title for the TOC section'
	},
	{
		name: 'position',
		type: 'string',
		required: false,
		default: 'top',
		description: 'Where to place TOC: "top", "after-title", or "bottom"'
	},
	{
		name: 'minHeaders',
		type: 'number',
		required: false,
		default: 2,
		description: 'Minimum number of headers required to generate TOC'
	}
];

/**
 * Validate parameters
 */
export const validate = (params) => {
	const errors = [];

	if (params.maxDepth !== undefined) {
		if (typeof params.maxDepth !== 'number') {
			errors.push({
				param: 'maxDepth',
				message: 'maxDepth must be a number',
				expected: 'number',
				actual: typeof params.maxDepth
			});
		} else if (params.maxDepth < 1 || params.maxDepth > 6) {
			errors.push({
				param: 'maxDepth',
				message: 'maxDepth must be between 1 and 6',
				expected: '1-6',
				actual: String(params.maxDepth)
			});
		}
	}

	if (params.position !== undefined) {
		const validPositions = ['top', 'after-title', 'bottom'];
		if (!validPositions.includes(params.position)) {
			errors.push({
				param: 'position',
				message: 'position must be "top", "after-title", or "bottom"',
				expected: validPositions.join(' | '),
				actual: String(params.position)
			});
		}
	}

	if (params.minHeaders !== undefined) {
		if (typeof params.minHeaders !== 'number' || params.minHeaders < 1) {
			errors.push({
				param: 'minHeaders',
				message: 'minHeaders must be a positive number',
				expected: '> 0',
				actual: String(params.minHeaders)
			});
		}
	}

	return errors;
};

/**
 * Generate slug for anchor links
 */
function generateSlug(text) {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Extract headers from markdown content
 */
function extractHeaders(content, maxDepth) {
	const headerRegex = /^(#{1,6})\s+(.+)$/gm;
	const headers = [];
	let match;

	while ((match = headerRegex.exec(content)) !== null) {
		const level = match[1].length;
		const text = match[2].trim();

		if (level <= maxDepth) {
			headers.push({
				level,
				text,
				slug: generateSlug(text),
				index: match.index
			});
		}
	}

	return headers;
}

/**
 * Generate TOC markdown
 */
function generateTOC(headers, title) {
	const toc = [`## ${title}\n`];

	for (const header of headers) {
		const indent = '  '.repeat(header.level - 1);
		toc.push(`${indent}- [${header.text}](#${header.slug})`);
	}

	return toc.join('\n');
}

/**
 * Insert TOC at specified position
 */
function insertTOC(content, toc, position, headers) {
	if (position === 'bottom') {
		return `${content}\n\n${toc}`;
	}

	if (position === 'after-title' && headers.length > 0) {
		// Insert after the first header
		const firstHeader = headers[0];
		const insertPos = firstHeader.index;

		// Find end of first header line
		const endOfLine = content.indexOf('\n', insertPos);
		if (endOfLine === -1) {
			return `${content}\n\n${toc}`;
		}

		const before = content.substring(0, endOfLine + 1);
		const after = content.substring(endOfLine + 1);

		return `${before}\n${toc}\n${after}`;
	}

	// Default: top
	return `${toc}\n\n${content}`;
}

/**
 * Apply function - generates TOC
 */
export const apply = (content, params, context) => {
	const maxDepth = params.maxDepth || 3;
	const title = params.title || 'Table of Contents';
	const position = params.position || 'top';
	const minHeaders = params.minHeaders || 2;

	// Extract headers
	const headers = extractHeaders(content, maxDepth);

	// Check if we have enough headers
	if (headers.length < minHeaders) {
		return content;
	}

	// Generate TOC
	const toc = generateTOC(headers, title);

	// Insert TOC at specified position
	return insertTOC(content, toc, position, headers);
};
