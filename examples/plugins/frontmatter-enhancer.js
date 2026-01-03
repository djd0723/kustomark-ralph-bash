/**
 * Frontmatter Enhancer Plugin
 *
 * Automatically populates frontmatter fields with computed values.
 * Can add dates, word counts, reading times, and more.
 *
 * @example
 * ```yaml
 * plugins:
 *   - name: frontmatter-enhancer
 *     source: ./examples/plugins/frontmatter-enhancer.js
 *
 * patches:
 *   - op: exec
 *     plugin: frontmatter-enhancer
 *     params:
 *       addWordCount: true
 *       addReadingTime: true
 *       addModifiedDate: true
 *       updateExisting: false
 * ```
 */

export const name = 'frontmatter-enhancer';
export const version = '1.0.0';
export const description = 'Automatically populates frontmatter with computed metadata';

export const params = [
	{
		name: 'addWordCount',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Add word count to frontmatter'
	},
	{
		name: 'addReadingTime',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Add estimated reading time'
	},
	{
		name: 'addModifiedDate',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Add last modified date (current date)'
	},
	{
		name: 'addFileInfo',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Add file path and name information'
	},
	{
		name: 'wordsPerMinute',
		type: 'number',
		required: false,
		default: 200,
		description: 'Reading speed for time calculation'
	},
	{
		name: 'updateExisting',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Update existing fields (otherwise skip if present)'
	}
];

/**
 * Extract frontmatter from content
 */
function extractFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

	if (!match) {
		return {
			hasFrontmatter: false,
			frontmatter: '',
			body: content,
			fullContent: content
		};
	}

	return {
		hasFrontmatter: true,
		frontmatter: match[1],
		body: match[2],
		fullContent: content
	};
}

/**
 * Parse YAML-like frontmatter to object
 */
function parseFrontmatter(yaml) {
	const obj = {};
	const lines = yaml.split('\n');

	for (const line of lines) {
		const match = line.match(/^(\w+):\s*(.*)$/);
		if (match) {
			const key = match[1];
			let value = match[2].trim();

			// Parse numbers
			if (/^\d+$/.test(value)) {
				value = parseInt(value, 10);
			}
			// Parse booleans
			else if (value === 'true') {
				value = true;
			} else if (value === 'false') {
				value = false;
			}
			// Remove quotes from strings
			else if (value.startsWith('"') && value.endsWith('"')) {
				value = value.slice(1, -1);
			}

			obj[key] = value;
		}
	}

	return obj;
}

/**
 * Serialize object to YAML-like frontmatter
 */
function serializeFrontmatter(obj) {
	const lines = [];

	for (const [key, value] of Object.entries(obj)) {
		if (typeof value === 'string') {
			// Quote strings with special chars
			if (value.includes(':') || value.includes('#')) {
				lines.push(`${key}: "${value}"`);
			} else {
				lines.push(`${key}: ${value}`);
			}
		} else {
			lines.push(`${key}: ${value}`);
		}
	}

	return lines.join('\n');
}

/**
 * Count words in body content
 */
function countWords(content) {
	const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '');
	const withoutInlineCode = withoutCodeBlocks.replace(/`[^`]+`/g, '');
	const words = withoutInlineCode.trim().split(/\s+/).filter(w => w.length > 0);
	return words.length;
}

/**
 * Calculate reading time
 */
function calculateReadingTime(wordCount, wordsPerMinute) {
	return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Get current date in ISO format
 */
function getCurrentDate() {
	return new Date().toISOString().split('T')[0];
}

/**
 * Get file name from path
 */
function getFileName(filePath) {
	return filePath.split('/').pop() || '';
}

/**
 * Apply function - enhances frontmatter
 */
export const apply = (content, params, context) => {
	const addWordCount = params.addWordCount !== false;
	const addReadingTime = params.addReadingTime !== false;
	const addModifiedDate = params.addModifiedDate === true;
	const addFileInfo = params.addFileInfo === true;
	const wordsPerMinute = params.wordsPerMinute || 200;
	const updateExisting = params.updateExisting === true;

	// Extract existing frontmatter
	const { hasFrontmatter, frontmatter, body } = extractFrontmatter(content);

	// Parse existing frontmatter or create new object
	const meta = hasFrontmatter ? parseFrontmatter(frontmatter) : {};

	// Add word count
	if (addWordCount && (updateExisting || !meta.wordCount)) {
		meta.wordCount = countWords(body);
	}

	// Add reading time
	if (addReadingTime && (updateExisting || !meta.readingTime)) {
		const words = meta.wordCount || countWords(body);
		meta.readingTime = calculateReadingTime(words, wordsPerMinute);
	}

	// Add modified date
	if (addModifiedDate && (updateExisting || !meta.modified)) {
		meta.modified = getCurrentDate();
	}

	// Add file info
	if (addFileInfo) {
		if (updateExisting || !meta.fileName) {
			meta.fileName = getFileName(context.file);
		}
		if (updateExisting || !meta.filePath) {
			meta.filePath = context.relativePath;
		}
	}

	// Serialize back to YAML
	const newFrontmatter = serializeFrontmatter(meta);

	// Reconstruct content
	return `---\n${newFrontmatter}\n---\n${body}`;
};
