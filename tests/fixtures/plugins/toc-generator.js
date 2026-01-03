/**
 * Table of Contents generator plugin
 * Generates a TOC from markdown headers
 */

export const name = 'toc-generator';
export const version = '1.0.0';
export const description = 'Generates table of contents from markdown headers';

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

	return errors;
};

/**
 * Apply function - generates TOC
 */
export const apply = (content, params, context) => {
	const maxDepth = params.maxDepth || 3;
	const title = params.title || 'Table of Contents';

	// Extract headers
	const headerRegex = /^(#{1,6})\s+(.+)$/gm;
	const headers = [];
	let match;

	while ((match = headerRegex.exec(content)) !== null) {
		const level = match[1].length;
		const text = match[2].trim();

		if (level <= maxDepth) {
			headers.push({ level, text });
		}
	}

	if (headers.length === 0) {
		return content;
	}

	// Generate TOC
	const toc = [`## ${title}\n`];
	for (const header of headers) {
		const indent = '  '.repeat(header.level - 1);
		const anchor = header.text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
		toc.push(`${indent}- [${header.text}](#${anchor})`);
	}

	return `${toc.join('\n')}\n\n${content}`;
};
