/**
 * Request validation middleware factory
 * @param {Object} schema - Object with optional body, params, query validators
 */
const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];

    if (schema.body) {
      const bodyErrors = validateFields(req.body, schema.body, 'body');
      errors.push(...bodyErrors);
    }

    if (schema.params) {
      const paramErrors = validateFields(req.params, schema.params, 'params');
      errors.push(...paramErrors);
    }

    if (schema.query) {
      const queryErrors = validateFields(req.query, schema.query, 'query');
      errors.push(...queryErrors);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

/**
 * Validate fields against rules
 */
function validateFields(data, rules, location) {
  const errors = [];

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];

    // Required check
    if (fieldRules.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, location, message: `${field} is required` });
      continue;
    }

    // Skip further checks if value is empty and not required
    if (value === undefined || value === null || value === '') continue;

    // Type check
    if (fieldRules.type) {
      if (fieldRules.type === 'email' && !isValidEmail(value)) {
        errors.push({ field, location, message: `${field} must be a valid email address` });
      }
      if (fieldRules.type === 'number' && isNaN(Number(value))) {
        errors.push({ field, location, message: `${field} must be a number` });
      }
      if (fieldRules.type === 'date' && isNaN(Date.parse(value))) {
        errors.push({ field, location, message: `${field} must be a valid date` });
      }
    }

    // Min length
    if (fieldRules.minLength && String(value).length < fieldRules.minLength) {
      errors.push({ field, location, message: `${field} must be at least ${fieldRules.minLength} characters` });
    }

    // Max length
    if (fieldRules.maxLength && String(value).length > fieldRules.maxLength) {
      errors.push({ field, location, message: `${field} must be at most ${fieldRules.maxLength} characters` });
    }

    // Min value
    if (fieldRules.min !== undefined && Number(value) < fieldRules.min) {
      errors.push({ field, location, message: `${field} must be at least ${fieldRules.min}` });
    }

    // Enum check
    if (fieldRules.enum && !fieldRules.enum.includes(value)) {
      errors.push({ field, location, message: `${field} must be one of: ${fieldRules.enum.join(', ')}` });
    }
  }

  return errors;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = validate;
