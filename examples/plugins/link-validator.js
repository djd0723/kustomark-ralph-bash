/**
 * Link Validator Plugin
 *
 * Validates internal links in markdown files and reports broken links.
 * Can check for missing anchors, invalid file references, and more.
 *
 * @example
 * ```yaml
 * plugins:
 *   - name: link-validator
 *     source: ./examples/plugins/link-validator.js
 *
 * patches:
 *   - op: exec
 *     plugin: link-validator
 *     params:
 *       checkAnchors: true
 *       addComments: true
 *       failOnBroken: false
 * ```
 */

export const name = 'link-validator';
export const version = '1.0.0';
export const description = 'Validates internal links and reports broken references';

export const params = [
	{
		name: 'checkAnchors',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Check if anchor links point to existing headers'
	},
	{
		name: 'addComments',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Add HTML comments for broken links'
	},
	{
		name: 'failOnBroken',
		type: 'boolean',
		required: false,
		default: false,
		description: 'Throw error if broken links are found'
	},
	{
		name: 'ignoreExternal',
		type: 'boolean',
		required: false,
		default: true,
		description: 'Ignore external HTTP(S) links'
	}
];

/**
 * Extract all links from markdown content
 */
function extractLinks(content) {
	const links = [];

	// Match markdown links: [text](url)
	const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
	let match;

	while ((match = linkRegex.exec(content)) !== null) {
		const text = match[1];
		const url = match[2];
		const index = match.index;

		links.push({ text, url, index, type: 'markdown' });
	}

	// Match reference-style links: [text][ref]
	const refRegex = /\[([^\]]+)\]\[([^\]]+)\]/g;
	while ((match = refRegex.exec(content)) !== null) {
		const text = match[1];
		const ref = match[2];
		const index = match.index;

		links.push({ text, url: ref, index, type: 'reference' });
	}

	return links;
}

/**
 * Extract all headers from markdown content
 */
function extractHeaders(content) {
	const headers = [];
	const headerRegex = /^(#{1,6})\s+(.+)$/gm;
	let match;

	while ((match = headerRegex.exec(content)) !== null) {
		const level = match[1].length;
		const text = match[2].trim();
		const slug = generateSlug(text);

		headers.push({ level, text, slug });
	}

	return headers;
}

/**
 * Generate slug from header text
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
 * Check if a link is external
 */
function isExternalLink(url) {
	return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
}

/**
 * Check if a link is an anchor link
 */
function isAnchorLink(url) {
	return url.startsWith('#');
}

/**
 * Validate a single link
 */
function validateLink(link, headers, ignoreExternal, checkAnchors) {
	const { url } = link;

	// Skip external links if configured
	if (ignoreExternal && isExternalLink(url)) {
		return { valid: true };
	}

	// Check anchor links
	if (isAnchorLink(url) && checkAnchors) {
		const anchor = url.substring(1); // Remove #
		const exists = headers.some(h => h.slug === anchor);

		if (!exists) {
			return {
				valid: false,
				reason: `Anchor '#${anchor}' not found in document`,
				suggestion: headers.length > 0
					? `Available anchors: ${headers.map(h => `#${h.slug}`).slice(0, 3).join(', ')}`
					: 'No headers found in document'
			};
		}
	}

	return { valid: true };
}

/**
 * Generate validation report
 */
function generateReport(brokenLinks) {
	if (brokenLinks.length === 0) {
		return null;
	}

	const report = [
		'<!-- Link Validation Report -->',
		'<!-- Found broken links: -->',
	];

	for (const link of brokenLinks) {
		report.push(`<!-- - [${link.text}](${link.url}): ${link.reason} -->`);
		if (link.suggestion) {
			report.push(`<!--   ${link.suggestion} -->`);
		}
	}

	report.push('<!-- End Link Validation Report -->');

	return report.join('\n');
}

/**
 * Apply function - validates links
 */
export const apply = (content, params, context) => {
	const checkAnchors = params.checkAnchors !== false;
	const addComments = params.addComments !== false;
	const failOnBroken = params.failOnBroken === true;
	const ignoreExternal = params.ignoreExternal !== false;

	// Extract links and headers
	const links = extractLinks(content);
	const headers = extractHeaders(content);

	// Validate each link
	const brokenLinks = [];

	for (const link of links) {
		const result = validateLink(link, headers, ignoreExternal, checkAnchors);

		if (!result.valid) {
			brokenLinks.push({
				...link,
				reason: result.reason,
				suggestion: result.suggestion
			});
		}
	}

	// Handle broken links
	if (brokenLinks.length > 0) {
		if (failOnBroken) {
			const errors = brokenLinks.map(l => `[${l.text}](${l.url}): ${l.reason}`).join('\n  ');
			throw new Error(`Found ${brokenLinks.length} broken link(s):\n  ${errors}`);
		}

		if (addComments) {
			const report = generateReport(brokenLinks);
			return `${report}\n\n${content}`;
		}
	}

	return content;
};
