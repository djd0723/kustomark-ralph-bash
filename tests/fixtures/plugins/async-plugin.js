/**
 * Asynchronous plugin that simulates async operations
 * Used for testing async plugin execution
 */

export const name = 'async-plugin';
export const version = '1.0.0';
export const description = 'Async plugin that simulates async operations';

export const params = [
	{
		name: 'delay',
		type: 'number',
		required: false,
		default: 100,
		description: 'Delay in milliseconds'
	},
	{
		name: 'prefix',
		type: 'string',
		required: false,
		default: '[ASYNC]',
		description: 'Prefix to add to content'
	}
];

/**
 * Async apply function - simulates async work with setTimeout
 */
export const apply = async (content, params, context) => {
	const delay = params.delay || 100;
	const prefix = params.prefix || '[ASYNC]';

	// Simulate async work
	await new Promise(resolve => setTimeout(resolve, delay));

	return `${prefix} ${content}`;
};
