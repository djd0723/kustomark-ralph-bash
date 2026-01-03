/**
 * Code Formatter Plugin
 *
 * Formats code blocks in markdown files. Adds syntax highlighting hints,
 * line numbers, and file name headers.
 *
 * @example
 * ```yaml
 * plugins:
 *   - name: code-formatter
 *     source: ./examples/plugins/code-formatter.js
 *
 * patches:
 *   - op: exec
 *     plugin: code-formatter
 *     params:
 *       addLineNumbers: true
 *       showLanguage: true
 *       highlightLines: [1, 5, 10]
 * ```
 */

export const name = 'code-formatter';
export const version = '1.0.0';
export const description = 'Formats code blocks with syntax highlighting and line numbers';

export const params = [
	{
		name: 'addLineNumbers',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Add line numbers to code blocks'
	},
	{
		name: 'showLanguage',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Show language label for code blocks'
	},
	{
		name: 'defaultLanguage',
		type: 'string',
		required: false,
		default: 'text',
		description: 'Default language for unlabeled code blocks'
	},
	{
		name: 'addCopyButton',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Add copy button hint (requires JavaScript)'
	},
	{
		name: 'wrapLines',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Enable line wrapping for long lines'
	}
];

/**
 * Extract code blocks from markdown
 */
function extractCodeBlocks(content) {
	const blocks = [];
	const regex = /```(\w*)\n([\s\S]*?)```/g;
	let match;

	while ((match = regex.exec(content)) !== null) {
		blocks.push({
			language: match[1] || '',
			code: match[2],
			fullMatch: match[0],
			index: match.index
		});
	}

	return blocks;
}

/**
 * Add line numbers to code
 */
function addLineNumbers(code) {
	const lines = code.split('\n');
	const maxDigits = String(lines.length).length;

	return lines
		.map((line, i) => {
			const lineNum = String(i + 1).padStart(maxDigits, ' ');
			return `${lineNum} | ${line}`;
		})
		.join('\n');
}

/**
 * Format a single code block
 */
function formatCodeBlock(block, params) {
	const {
		addLineNumbers: shouldAddLineNumbers,
		showLanguage,
		defaultLanguage,
		addCopyButton,
		wrapLines
	} = params;

	let { language, code } = block;

	// Use default language if none specified
	if (!language) {
		language = defaultLanguage || 'text';
	}

	// Add line numbers if requested
	if (shouldAddLineNumbers) {
		code = addLineNumbers(code);
	}

	// Build the code block
	const parts = [];

	// Add language/metadata header if requested
	if (showLanguage || addCopyButton || wrapLines) {
		const attrs = [];
		if (wrapLines) attrs.push('wrap');
		if (addCopyButton) attrs.push('copy');

		const attrString = attrs.length > 0 ? ` {${attrs.join(' ')}}` : '';
		parts.push(`\`\`\`${language}${attrString}`);
	} else {
		parts.push(`\`\`\`${language}`);
	}

	parts.push(code);
	parts.push('```');

	return parts.join('\n');
}

/**
 * Apply function - formats code blocks
 */
export const apply = (content, params, context) => {
	const addLineNumbers = params.addLineNumbers === true;
	const showLanguage = params.showLanguage !== false;
	const defaultLanguage = params.defaultLanguage || 'text';
	const addCopyButton = params.addCopyButton === true;
	const wrapLines = params.wrapLines === true;

	// Extract code blocks
	const blocks = extractCodeBlocks(content);

	if (blocks.length === 0) {
		return content;
	}

	// Process each block (in reverse order to preserve indices)
	let result = content;
	for (let i = blocks.length - 1; i >= 0; i--) {
		const block = blocks[i];
		const formatted = formatCodeBlock(block, {
			addLineNumbers,
			showLanguage,
			defaultLanguage,
			addCopyButton,
			wrapLines
		});

		result =
			result.substring(0, block.index) +
			formatted +
			result.substring(block.index + block.fullMatch.length);
	}

	return result;
};
