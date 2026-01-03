/**
 * Validator plugin with comprehensive parameter validation
 * Tests parameter validation functionality
 */

export const name = 'validator-plugin';
export const version = '1.0.0';
export const description = 'Plugin with comprehensive parameter validation';

export const params = [
	{
		name: 'required',
		type: 'string',
		required: true,
		description: 'A required parameter'
	},
	{
		name: 'minValue',
		type: 'number',
		required: false,
		description: 'Number must be >= 0'
	},
	{
		name: 'choices',
		type: 'string',
		required: false,
		description: 'Must be one of: option1, option2, option3'
	}
];

/**
 * Comprehensive validation
 */
export const validate = (params) => {
	const errors = [];

	// Check required parameter
	if (!params.required) {
		errors.push({
			param: 'required',
			message: 'required parameter is required',
			expected: 'string',
			actual: typeof params.required
		});
	}

	// Check minValue
	if (params.minValue !== undefined) {
		if (typeof params.minValue !== 'number') {
			errors.push({
				param: 'minValue',
				message: 'minValue must be a number',
				expected: 'number',
				actual: typeof params.minValue
			});
		} else if (params.minValue < 0) {
			errors.push({
				param: 'minValue',
				message: 'minValue must be >= 0',
				expected: '>= 0',
				actual: String(params.minValue)
			});
		}
	}

	// Check choices
	if (params.choices !== undefined) {
		const validChoices = ['option1', 'option2', 'option3'];
		if (!validChoices.includes(params.choices)) {
			errors.push({
				param: 'choices',
				message: 'choices must be one of: option1, option2, option3',
				expected: 'option1 | option2 | option3',
				actual: String(params.choices)
			});
		}
	}

	return errors;
};

/**
 * Apply function
 */
export const apply = (content, params, context) => {
	return `[VALIDATED] ${content}`;
};
