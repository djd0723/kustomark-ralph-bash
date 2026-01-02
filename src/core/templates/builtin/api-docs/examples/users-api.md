# Users API

Manage user accounts and profiles.

## List Users

Get a paginated list of users.

### Request

**Method:** `GET`

**Endpoint:** `/api/{{API_VERSION}}/users`

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 10 | Maximum number of results (1-100) |
| `offset` | integer | No | 0 | Pagination offset |
| `sort` | string | No | `created_at` | Sort field (`name`, `email`, `created_at`) |
| `order` | string | No | `desc` | Sort order (`asc` or `desc`) |
| `status` | string | No | - | Filter by status (`active`, `inactive`, `pending`) |

### Response

**Success Response (200 OK):**

```json
{
  "data": [
    {
      "id": "usr_123",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
      "role": "user",
      "created_at": "2024-03-01T10:00:00Z",
      "updated_at": "2024-03-15T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

### Examples

**List all users:**

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/users" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**List active users with pagination:**

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/users?status=active&limit=20&offset=40" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Get User

Get a specific user by ID.

### Request

**Method:** `GET`

**Endpoint:** `/api/{{API_VERSION}}/users/:id`

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User ID (format: `usr_*`) |

### Response

**Success Response (200 OK):**

```json
{
  "data": {
    "id": "usr_123",
    "name": "John Doe",
    "email": "john@example.com",
    "status": "active",
    "role": "user",
    "profile": {
      "bio": "Software developer",
      "location": "San Francisco, CA",
      "website": "https://johndoe.com"
    },
    "created_at": "2024-03-01T10:00:00Z",
    "updated_at": "2024-03-15T10:00:00Z"
  }
}
```

### Examples

```bash
curl -X GET "{{BASE_URL}}/api/{{API_VERSION}}/users/usr_123" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Create User

Create a new user account.

### Request

**Method:** `POST`

**Endpoint:** `/api/{{API_VERSION}}/users`

**Authentication:** Required (scope: `users:write`)

**Request Body:**

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "secure_password_123",
  "role": "user"
}
```

**Request Body Schema:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Full name (3-100 characters) |
| `email` | string | Yes | Valid email address (unique) |
| `password` | string | Yes | Password (min 8 characters) |
| `role` | string | No | User role (`user`, `admin`) - default: `user` |

### Response

**Success Response (201 Created):**

```json
{
  "data": {
    "id": "usr_124",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "status": "pending",
    "role": "user",
    "created_at": "2024-03-15T10:05:00Z"
  }
}
```

### Examples

```bash
curl -X POST "{{BASE_URL}}/api/{{API_VERSION}}/users" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane@example.com",
    "password": "secure_password_123"
  }'
```

## Update User

Update an existing user.

### Request

**Method:** `PUT`

**Endpoint:** `/api/{{API_VERSION}}/users/:id`

**Authentication:** Required (scope: `users:write`)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User ID |

**Request Body:**

```json
{
  "name": "Jane Doe",
  "profile": {
    "bio": "Updated bio",
    "location": "New York, NY"
  }
}
```

### Response

**Success Response (200 OK):**

```json
{
  "data": {
    "id": "usr_124",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "status": "active",
    "profile": {
      "bio": "Updated bio",
      "location": "New York, NY"
    },
    "updated_at": "2024-03-15T10:10:00Z"
  }
}
```

### Examples

```bash
curl -X PUT "{{BASE_URL}}/api/{{API_VERSION}}/users/usr_124" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "profile": {
      "bio": "Updated bio"
    }
  }'
```

## Delete User

Delete a user account.

### Request

**Method:** `DELETE`

**Endpoint:** `/api/{{API_VERSION}}/users/:id`

**Authentication:** Required (scope: `users:delete`)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User ID |

### Response

**Success Response (204 No Content)**

No response body.

### Examples

```bash
curl -X DELETE "{{BASE_URL}}/api/{{API_VERSION}}/users/usr_124" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Update User Status

Change a user's status.

### Request

**Method:** `PATCH`

**Endpoint:** `/api/{{API_VERSION}}/users/:id/status`

**Authentication:** Required (scope: `users:write`)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | User ID |

**Request Body:**

```json
{
  "status": "inactive"
}
```

**Valid Statuses:**
- `active` - User is active
- `inactive` - User is temporarily inactive
- `suspended` - User is suspended
- `pending` - User registration pending

### Response

**Success Response (200 OK):**

```json
{
  "data": {
    "id": "usr_123",
    "status": "inactive",
    "updated_at": "2024-03-15T10:15:00Z"
  }
}
```

### Examples

```bash
curl -X PATCH "{{BASE_URL}}/api/{{API_VERSION}}/users/usr_123/status" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive"
  }'
```

## Common Errors

### Email Already Exists

```json
{
  "error": {
    "code": "ALREADY_EXISTS",
    "message": "User with this email already exists",
    "details": {
      "field": "email",
      "value": "jane@example.com"
    }
  }
}
```

### Invalid User ID

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "details": {
      "id": "usr_999"
    }
  }
}
```

### Validation Error

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
          "field": "password",
          "message": "Password must be at least 8 characters"
        }
      ]
    }
  }
}
```

## Related Endpoints

- [Authentication](./authentication.md)
- [Products API](./products-api.md)
