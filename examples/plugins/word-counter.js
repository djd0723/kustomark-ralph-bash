/**
 * Word Counter Plugin
 *
 * Adds word count, character count, and reading time statistics to markdown files.
 * Can be configured to show/hide specific statistics and customize formatting.
 *
 * @example
 * ```yaml
 * plugins:
 *   - name: word-counter
 *     source: ./examples/plugins/word-counter.js
 *
 * patches:
 *   - op: exec
 *     plugin: word-counter
 *     params:
 *       showWords: true
 *       showChars: true
 *       showReadingTime: true
 *       wordsPerMinute: 200
 * ```
 */

export const name = 'word-counter';
export const version = '1.0.0';
export const description = 'Adds word count and reading time statistics to markdown';

export const params = [
	{
		name: 'showWords',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Show word count'
	},
	{
		name: 'showChars',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Show character count'
	},
	{
		name: 'showReadingTime',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Show estimated reading time'
	},
	{
		name: 'wordsPerMinute',
		type: 'number',
		required: false,
		default: 200,
		description: 'Average reading speed for time calculation'
	},
	{
		name: 'position',
		type: 'string',
		required: false,
		default: 'bottom',
		description: 'Where to place stats: "top" or "bottom"'
	},
	{
		name: 'format',
		type: 'string',
		required: false,
		default: 'markdown',
		description: 'Output format: "markdown", "html", or "badge"'
	}
];

/**
 * Validate parameters
 */
export const validate = (params) => {
	const errors = [];

	if (params.wordsPerMinute !== undefined) {
		if (typeof params.wordsPerMinute !== 'number' || params.wordsPerMinute <= 0) {
			errors.push({
				param: 'wordsPerMinute',
				message: 'wordsPerMinute must be a positive number',
				expected: '> 0',
				actual: String(params.wordsPerMinute)
			});
		}
	}

	if (params.position !== undefined) {
		const validPositions = ['top', 'bottom'];
		if (!validPositions.includes(params.position)) {
			errors.push({
				param: 'position',
				message: 'position must be "top" or "bottom"',
				expected: 'top | bottom',
				actual: String(params.position)
			});
		}
	}

	if (params.format !== undefined) {
		const validFormats = ['markdown', 'html', 'badge'];
		if (!validFormats.includes(params.format)) {
			errors.push({
				param: 'format',
				message: 'format must be "markdown", "html", or "badge"',
				expected: 'markdown | html | badge',
				actual: String(params.format)
			});
		}
	}

	return errors;
};

/**
 * Count words in content (excluding code blocks)
 */
function countWords(content) {
	// Remove code blocks
	const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
	const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, '');

	// Count words
	const words = withoutInlineCode.trim().split(/\s+/).filter(w => w.length > 0);
	return words.length;
}

/**
 * Calculate reading time in minutes
 */
function calculateReadingTime(wordCount, wordsPerMinute) {
	const minutes = Math.ceil(wordCount / wordsPerMinute);
	return minutes;
}

/**
 * Format statistics as markdown
 */
function formatAsMarkdown(stats) {
	const parts = [];

	if (stats.words !== undefined) {
		parts.push(`**${stats.words}** words`);
	}

	if (stats.chars !== undefined) {
		parts.push(`**${stats.chars}** characters`);
	}

	if (stats.readingTime !== undefined) {
		const time = stats.readingTime === 1 ? '1 minute' : `${stats.readingTime} minutes`;
		parts.push(`**${time}** read`);
	}

	return `---\n\n📊 **Statistics:** ${parts.join(' • ')}\n`;
}

/**
 * Format statistics as HTML
 */
function formatAsHTML(stats) {
	const parts = [];

	if (stats.words !== undefined) {
		parts.push(`<strong>${stats.words}</strong> words`);
	}

	if (stats.chars !== undefined) {
		parts.push(`<strong>${stats.chars}</strong> characters`);
	}

	if (stats.readingTime !== undefined) {
		const time = stats.readingTime === 1 ? '1 minute' : `${stats.readingTime} minutes`;
		parts.push(`<strong>${time}</strong> read`);
	}

	return `<div class="doc-stats">\n  📊 <strong>Statistics:</strong> ${parts.join(' • ')}\n</div>\n`;
}

/**
 * Format statistics as shields.io style badges
 */
function formatAsBadge(stats) {
	const badges = [];

	if (stats.words !== undefined) {
		badges.push(`![Words](https://img.shields.io/badge/words-${stats.words}-blue)`);
	}

	if (stats.chars !== undefined) {
		badges.push(`![Characters](https://img.shields.io/badge/characters-${stats.chars}-green)`);
	}

	if (stats.readingTime !== undefined) {
		badges.push(`![Reading Time](https://img.shields.io/badge/reading%20time-${stats.readingTime}%20min-orange)`);
	}

	return badges.join(' ') + '\n';
}

/**
 * Apply function - adds statistics
 */
export const apply = (content, params, context) => {
	const showWords = params.showWords !== false;
	const showChars = params.showChars !== false;
	const showReadingTime = params.showReadingTime !== false;
	const wordsPerMinute = params.wordsPerMinute || 200;
	const position = params.position || 'bottom';
	const format = params.format || 'markdown';

	// Calculate statistics
	const stats = {};

	if (showWords) {
		stats.words = countWords(content);
	}

	if (showChars) {
		stats.chars = content.length;
	}

	if (showReadingTime && stats.words !== undefined) {
		stats.readingTime = calculateReadingTime(stats.words, wordsPerMinute);
	}

	// Check if any stats to show
	if (Object.keys(stats).length === 0) {
		return content;
	}

	// Format statistics
	let statsText;
	if (format === 'html') {
		statsText = formatAsHTML(stats);
	} else if (format === 'badge') {
		statsText = formatAsBadge(stats);
	} else {
		statsText = formatAsMarkdown(stats);
	}

	// Insert at position
	if (position === 'top') {
		return `${statsText}\n${content}`;
	}

	return `${content}\n\n${statsText}`;
};
