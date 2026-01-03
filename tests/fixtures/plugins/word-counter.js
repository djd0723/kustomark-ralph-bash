/**
 * Word counter plugin that counts words and characters
 * Adds statistics to the end of the content
 */

export const name = 'word-counter';
export const version = '1.0.0';
export const description = 'Counts words and characters in markdown content';

export const params = [
	{
		name: 'showChars',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Whether to show character count'
	},
	{
		name: 'showWords',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Whether to show word count'
	}
];

/**
 * Apply function - counts words and characters
 */
export const apply = (content, params, context) => {
	const showChars = params.showChars !== false;
	const showWords = params.showWords !== false;

	const words = content.trim().split(/\s+/).length;
	const chars = content.length;

	const stats = [];
	if (showWords) {
		stats.push(`Words: ${words}`);
	}
	if (showChars) {
		stats.push(`Characters: ${chars}`);
	}

	if (stats.length === 0) {
		return content;
	}

	return `${content}\n\n---\n\n**Statistics:** ${stats.join(' | ')}`;
};
