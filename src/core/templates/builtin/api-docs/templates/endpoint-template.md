# API Endpoint Template

Use this template to document new API endpoints consistently.

## Endpoint Name

Brief description of what this endpoint does.

### Request

**Method:** `GET` | `POST` | `PUT` | `DELETE` | `PATCH`

**Endpoint:** `/api/{{API_VERSION}}/resource`

**Authentication:** Required | Optional | None

**Headers:**

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token for authentication |
| `Content-Type` | Yes | `application/json` |

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Resource identifier |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 10 | Maximum number of results |
| `offset` | integer | No | 0 | Pagination offset |
| `sort` | string | No | `created_at` | Sort field |
| `order` | string | No | `desc` | Sort order (`asc` or `desc`) |

**Request Body:**

```json
{
  "field1": "string",
  "field2": "integer",
  "field3": {
    "nested": "object"
  }
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `field1` | string | Yes | Description of field1 |
| `field2` | integer | No | Description of field2 |
| `field3` | object | No | Description of field3 |

### Response

**Success Response (200 OK):**

```json
{
  "data": {
    "id": "123",
    "field1": "value",
    "created_at": "2024-03-15T10:00:00Z"
  },
  "meta": {
    "timestamp": "2024-03-15T10:00:00Z"
  }
}
```

**Response Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `data` | object | The resource data |
| `data.id` | string | Resource identifier |
| `data.field1` | string | Description of field |
| `data.created_at` | string | ISO 8601 timestamp |
| `meta` | object | Response metadata |

**Error Responses:**

- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

See [Error Handling](./errors.md) for error response format.

### Examples

#### Example 1: Basic Request

**Request:**

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/resource/123" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Response:**

```json
{
  "data": {
    "id": "123",
    "field1": "example value",
    "created_at": "2024-03-15T10:00:00Z"
  }
}
```

#### Example 2: With Query Parameters

**Request:**

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/resource?limit=5&sort=name&order=asc" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "data": [
    {
      "id": "1",
      "field1": "A"
    },
    {
      "id": "2",
      "field1": "B"
    }
  ],
  "meta": {
    "total": 50,
    "limit": 5,
    "offset": 0
  }
}
```

#### Example 3: POST Request

**Request:**

```bash
curl -X POST "{{BASE_URL}}/api/{{API_VERSION}}/resource" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "field1": "new value",
    "field2": 42
  }'
```

**Response:**

```json
{
  "data": {
    "id": "124",
    "field1": "new value",
    "field2": 42,
    "created_at": "2024-03-15T10:05:00Z"
  }
}
```

### Rate Limiting

This endpoint is subject to rate limiting:

- **Limit:** {{RATE_LIMIT}} requests per minute
- **Headers:** See rate limit headers in response

### Notes

- Additional notes about the endpoint
- Special considerations
- Performance tips
- Caching information

### Related Endpoints

- [Related Endpoint 1](#)
- [Related Endpoint 2](#)

### Changelog

- `v1.0.0` - Initial release
- `v1.1.0` - Added query parameter `filter`
