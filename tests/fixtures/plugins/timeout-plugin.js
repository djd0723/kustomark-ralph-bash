/**
 * Timeout plugin that takes too long to execute
 * Used for testing timeout enforcement
 */

export const name = 'timeout-plugin';
export const version = '1.0.0';
export const description = 'Plugin that takes too long to execute';

export const params = [
	{
		name: 'delay',
		type: 'number',
		required: false,
		default: 60000,
		description: 'Delay in milliseconds (defaults to 60s)'
	}
];

/**
 * Apply function - sleeps for specified delay
 */
export const apply = async (content, params, context) => {
	const delay = params.delay || 60000;

	// This will exceed the default timeout
	await new Promise(resolve => setTimeout(resolve, delay));

	return content;
};
