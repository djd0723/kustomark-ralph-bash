/**
 * Error plugin that throws errors for testing error handling
 */

export const name = 'error-plugin';
export const version = '1.0.0';
export const description = 'Plugin that throws errors for testing';

export const params = [
	{
		name: 'errorType',
		type: 'string',
		required: false,
		default: 'generic',
		description: 'Type of error to throw: generic, validation, runtime'
	}
];

/**
 * Validate parameters - throws error if errorType is 'validation'
 */
export const validate = (params) => {
	if (params.errorType === 'validation') {
		return [{
			param: 'errorType',
			message: 'Validation error triggered intentionally',
			expected: 'anything but "validation"',
			actual: 'validation'
		}];
	}
	return [];
};

/**
 * Apply function - throws error based on errorType
 */
export const apply = (content, params, context) => {
	const errorType = params.errorType || 'generic';

	if (errorType === 'runtime') {
		throw new Error('Runtime error triggered intentionally');
	}

	if (errorType === 'type') {
		// Return wrong type
		return 12345;
	}

	if (errorType === 'generic') {
		throw new Error('Generic error triggered');
	}

	return content;
};
