# 🚀 API Documentation - ADT Extracteur v2.0

## Base URL
```
Production: https://your-app.vercel.app/api
Development: http://localhost:5173/api
```

---

## 🔐 Security

### Rate Limiting
- **General API**: 100 requests/minute per IP
- **Extraction API**: 20 requests/minute per IP
- **Response**: 429 Too Many Requests when exceeded

### CORS
Allowed origins:
- `https://adt-taxi-coop.vercel.app`
- `https://adt-app.vercel.app`
- `http://localhost:5173` (development)
- `http://localhost:3000` (development)

### Validation
All inputs validated with Zod schemas.

---

## 📡 Endpoints

### 1. Health Check
**GET** `/api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-04T10:30:00.000Z",
  "uptime": 123.45,
  "database": {
    "status": "connected",
    "responseTime": 15
  },
  "api": {
    "version": "2.0.0",
    "environment": "production"
  },
  "responseTime": 20
}
```

---

### 2. User Authentication
**POST** `/api/users`

**Request**:
```json
{
  "numDome": "123",
  "idEmploye": "EMP001",
  "telephone": "514-555-0100",
  "isAdmin": false
}
```

**Validation**:
- `numDome`: string, required, 1-50 chars
- `idEmploye`: string, required, 1-50 chars
- `telephone`: string, optional
- `isAdmin`: boolean, default false

**Response** (200 - Existing User):
```json
{
  "id": 1,
  "numDome": "123",
  "idEmploye": "EMP001",
  "telephone": "514-555-0100",
  "isAdmin": false,
  "createdAt": "2026-01-04T10:00:00.000Z",
  "message": "User authenticated successfully"
}
```

**Response** (201 - New User):
```json
{
  "id": 2,
  "numDome": "456",
  "idEmploye": "EMP002",
  "telephone": null,
  "isAdmin": false,
  "createdAt": "2026-01-04T10:30:00.000Z",
  "message": "User created successfully"
}
```

**Errors**:
- `400` - Validation failed
- `409` - User already exists (duplicate)
- `429` - Rate limit exceeded
- `500` - Internal server error

---

### 3. List Extractions
**GET** `/api/extractions?userDome={id}&section={tct|olymel}`

**Query Parameters**:
- `userDome` (required): User domain number
- `section` (optional): Filter by section ("tct" or "olymel")

**Response** (200):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "123",
    "section": "tct",
    "fileName": "transport_2026.pdf",
    "status": "success",
    "content": {
      "headers": ["Tournée", "Nom", "..."],
      "rows": [["T001", "Route A", "..."]]
    },
    "createdAt": "2026-01-04T09:00:00.000Z"
  }
]
```

**Errors**:
- `400` - Missing or invalid userDome
- `400` - Invalid section (must be "tct" or "olymel")
- `429` - Rate limit exceeded
- `500` - Database error

---

### 4. Save Extraction
**POST** `/api/extractions`

**Request**:
```json
{
  "userId": "123",
  "section": "tct",
  "fileName": "transport_2026.pdf",
  "status": "success",
  "content": {
    "headers": ["Tournée", "Nom"],
    "rows": [["T001", "Route A"]]
  }
}
```

**Validation**:
- `userId`: string, required
- `section`: enum ["tct", "olymel"], required
- `fileName`: string, required
- `status`: enum ["idle", "processing", "ai_processing", "success", "error"]
- `content`: object with headers (array) and rows (array), nullable

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "123",
  "section": "tct",
  "fileName": "transport_2026.pdf",
  "status": "success",
  "content": { ... },
  "createdAt": "2026-01-04T10:00:00.000Z",
  "message": "Extraction saved successfully"
}
```

**Errors**:
- `400` - Validation failed
- `400` - Invalid user (foreign key violation)
- `429` - Rate limit exceeded
- `500` - Database error

---

### 5. Delete Extraction
**DELETE** `/api/extractions/{id}`

**Path Parameters**:
- `id`: UUID of the extraction

**Response** (200):
```json
{
  "success": true,
  "message": "Extraction deleted successfully"
}
```

**Errors**:
- `400` - Missing or invalid ID
- `404` - Extraction not found
- `429` - Rate limit exceeded
- `500` - Database error

---

### 6. AI Extraction
**POST** `/api/extract`

**Headers**:
- `Content-Type`: application/json
- `X-API-Key` (optional): Custom OpenRouter API key
- `X-Model` (optional): Custom AI model

**Request**:
```json
{
  "prompt": "Extract table data",
  "image": "base64_encoded_image",
  "mimeType": "image/jpeg",
  "systemInstruction": "Extract TCT data",
  "temperature": 0.1,
  "schema": { ... },
  "responseMimeType": "application/json"
}
```

**Validation**:
- `prompt` or `image`: At least one required
- `mimeType`: Must be image/jpeg, image/png, or image/webp
- `temperature`: 0-2

**Response** (200):
```json
{
  "text": "{ \"entries\": [...] }"
}
```

**Errors**:
- `400` - Invalid request (missing prompt/image or invalid MIME type)
- `408` - Request timeout (60s)
- `429` - Rate limit exceeded (20 req/min)
- `500` - Internal server error

---

## 📊 Error Response Format

All errors follow this format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": ["Optional array of validation errors"]
}
```

**Common Error Codes**:
- `400` - Bad Request (validation failed)
- `404` - Not Found
- `405` - Method Not Allowed
- `408` - Request Timeout
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
- `503` - Service Unavailable (database down)

---

## 🔧 Development

### Testing Endpoints

```bash
# Health check
curl https://your-app.vercel.app/api/health

# Create user
curl -X POST https://your-app.vercel.app/api/users \
  -H "Content-Type: application/json" \
  -d '{"numDome":"123","idEmploye":"EMP001"}'

# List extractions
curl "https://your-app.vercel.app/api/extractions?userDome=123&section=tct"

# Delete extraction
curl -X DELETE https://your-app.vercel.app/api/extractions/{id}
```

---

## 📈 Performance

### Database Indexes
Optimized queries with indexes on:
- `extractions(userId)`
- `extractions(userId, section)`
- `extractions(createdAt DESC)`
- `users(numDome)`

### Response Times (avg)
- Health check: ~20ms
- User auth: ~50ms
- List extractions: ~100ms
- Save extraction: ~150ms
- AI extraction: ~5-30s (depends on AI model)

---

## 🔐 Best Practices

### Client-Side
1. Implement exponential backoff for 429 errors
2. Cache user authentication tokens
3. Validate data before sending to API
4. Handle errors gracefully with user feedback

### Server-Side
1. All inputs validated with Zod
2. Rate limiting enforced
3. CORS restricted to known origins
4. Errors logged but not exposed in production
5. Database connections pooled automatically (Neon)

---

## 📝 Changelog

### v2.0.0 (2026-01-04)
- ✅ Added Zod validation for all endpoints
- ✅ Implemented rate limiting (100 req/min)
- ✅ Restricted CORS to whitelist
- ✅ Added health check endpoint
- ✅ Improved error handling with specific codes
- ✅ Added database indexes for performance
- ✅ Structured logging for monitoring

---

## 🆘 Support

For issues or questions:
- Check health endpoint: `/api/health`
- Review error messages for details
- Check rate limit headers in response
- Verify CORS origin is whitelisted

**Propulsé par Zakibelm © 2026**
