# Error Handling

{{API_NAME}} uses standard HTTP status codes and returns detailed error information in a consistent format.

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "additional context"
    },
    "request_id": "req_abc123",
    "timestamp": "2024-03-15T10:00:00Z"
  }
}
```

## HTTP Status Codes

### 2xx Success

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 202 | Accepted | Request accepted for processing |
| 204 | No Content | Request succeeded with no response body |

### 4xx Client Errors

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid request parameters or body |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Request conflicts with current state |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |

### 5xx Server Errors

| Code | Status | Description |
|------|--------|-------------|
| 500 | Internal Server Error | Server encountered an error |
| 502 | Bad Gateway | Invalid response from upstream |
| 503 | Service Unavailable | Service temporarily unavailable |
| 504 | Gateway Timeout | Upstream request timeout |

## Error Codes

### Authentication Errors

#### UNAUTHORIZED

Missing or invalid API key.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key",
    "details": {
      "header": "Authorization header is required"
    }
  }
}
```

**How to Fix:**
- Verify your API key is correct
- Check the Authorization header format
- Ensure the key hasn't been revoked

#### FORBIDDEN

Valid authentication but insufficient permissions.

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this resource",
    "details": {
      "required_scope": "users:write",
      "current_scopes": ["users:read"]
    }
  }
}
```

**How to Fix:**
- Check your API key scopes
- Request additional permissions if needed
- Contact support to upgrade permissions

### Validation Errors

#### VALIDATION_ERROR

Request validation failed.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        {
          "field": "email",
          "message": "Invalid email format"
        },
        {
          "field": "age",
          "message": "Must be at least 18"
        }
      ]
    }
  }
}
```

**How to Fix:**
- Review the field-specific error messages
- Correct the invalid fields
- Ensure all required fields are provided

#### MISSING_REQUIRED_FIELD

Required field is missing.

```json
{
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "Required field is missing",
    "details": {
      "field": "name",
      "location": "body"
    }
  }
}
```

**How to Fix:**
- Include the required field in your request
- Check the API documentation for required fields

### Resource Errors

#### NOT_FOUND

Resource not found.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "details": {
      "resource": "user",
      "id": "123"
    }
  }
}
```

**How to Fix:**
- Verify the resource ID is correct
- Check if the resource has been deleted
- Ensure you have permission to access the resource

#### ALREADY_EXISTS

Resource already exists.

```json
{
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "Resource already exists",
    "details": {
      "resource": "user",
      "field": "email",
      "value": "user@example.com"
    }
  }
}
```

**How to Fix:**
- Use a different unique identifier
- Update the existing resource instead
- Delete the existing resource first (if appropriate)

#### CONFLICT

Request conflicts with current state.

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Resource has been modified",
    "details": {
      "current_version": "v2",
      "requested_version": "v1"
    }
  }
}
```

**How to Fix:**
- Fetch the latest version of the resource
- Resolve conflicts manually
- Use optimistic locking if supported

### Rate Limiting Errors

#### RATE_LIMIT_EXCEEDED

Too many requests.

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": "{{RATE_LIMIT}}",
      "period": "minute",
      "retry_after": 30
    }
  }
}
```

**Response Headers:**
```
X-RateLimit-Limit: {{RATE_LIMIT}}
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710504000
Retry-After: 30
```

**How to Fix:**
- Wait for the rate limit to reset
- Implement exponential backoff
- Upgrade to a higher plan
- Optimize your requests to reduce frequency

### Server Errors

#### INTERNAL_ERROR

Internal server error.

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An internal error occurred",
    "details": {
      "request_id": "req_abc123"
    }
  }
}
```

**How to Fix:**
- Retry the request with exponential backoff
- Contact support with the request_id
- Check status page for ongoing issues

#### SERVICE_UNAVAILABLE

Service temporarily unavailable.

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service is temporarily unavailable",
    "details": {
      "retry_after": 60,
      "reason": "scheduled_maintenance"
    }
  }
}
```

**How to Fix:**
- Wait and retry after the specified time
- Check the status page for maintenance windows
- Subscribe to status updates

## Error Handling Best Practices

### 1. Always Check Status Codes

```javascript
const response = await fetch('{{BASE_URL}}/api/{{API_VERSION}}/endpoint', {
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
  },
});

if (!response.ok) {
  const error = await response.json();
  console.error('API Error:', error);
  // Handle error appropriately
}
```

### 2. Implement Retry Logic

```javascript
async function apiRequest(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 1;
        await sleep(retryAfter * 1000);
        continue;
      }

      if (response.ok) {
        return await response.json();
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

### 3. Log Errors Properly

```javascript
try {
  const result = await apiRequest(url, options);
} catch (error) {
  console.error('API Request Failed:', {
    url,
    error: error.message,
    request_id: error.request_id,
    timestamp: new Date().toISOString(),
  });

  // Send to error tracking service
  errorTracker.captureException(error);
}
```

### 4. Display User-Friendly Messages

```javascript
function getErrorMessage(error) {
  const messages = {
    'UNAUTHORIZED': 'Please log in again',
    'FORBIDDEN': 'You don\'t have permission to do this',
    'NOT_FOUND': 'The requested item was not found',
    'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later',
    'VALIDATION_ERROR': 'Please check your input and try again',
    'INTERNAL_ERROR': 'Something went wrong. Please try again',
  };

  return messages[error.code] || 'An error occurred';
}
```

### 5. Handle Timeouts

```javascript
async function fetchWithTimeout(url, options, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Request IDs

Every API response includes a unique `request_id` for debugging:

```json
{
  "error": {
    "request_id": "req_abc123xyz"
  }
}
```

Include this ID when contacting support for faster resolution.

## Status Page

Check the API status page for real-time service status:

[{{BASE_URL}}/status]({{BASE_URL}}/status)

## Support

For help with errors, contact {{CONTACT_EMAIL}} with:
- The `request_id` from the error response
- The timestamp of the error
- A description of what you were trying to do
- Your API key prefix (first 8 characters only)
