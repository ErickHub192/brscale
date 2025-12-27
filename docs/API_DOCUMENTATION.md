# BR SCALE - API Documentation

## 📡 API Endpoints

Base URL: `http://localhost:3000/api` (development)

---

## 🏠 Properties Endpoints

### 1. **Create Property**

Creates a new property listing.

**Endpoint**: `POST /api/properties`

**Request Body**:
```json
{
  "userId": "user_123",
  "title": "Beautiful 3BR House in Downtown",
  "description": "Spacious family home with modern amenities...",
  "address": {
    "street": "123 Main St",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701",
    "country": "USA"
  },
  "price": 450000,
  "bedrooms": 3,
  "bathrooms": 2,
  "squareFeet": 2000,
  "propertyType": "house",
  "images": ["https://example.com/image1.jpg"],
  "videos": []
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Property created successfully",
  "data": {
    "property": {
      "id": "prop_abc123",
      "userId": "user_123",
      "title": "Beautiful 3BR House in Downtown",
      "status": "draft"
    }
  }
}
```

---

### 2. **List Properties**

Get all properties (with optional filtering).

**Endpoint**: `GET /api/properties`

**Query Parameters**:
- `userId` (optional): Filter by user ID
- `status` (optional): Filter by status (draft, active, under_offer, sold)

**Example**:
```
GET /api/properties?userId=user_123&status=active
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "properties": [
      {
        "id": "prop_abc123",
        "userId": "user_123",
        "title": "Beautiful 3BR House in Downtown",
        "description": "...",
        "address": { ... },
        "price": 450000,
        "bedrooms": 3,
        "bathrooms": 2,
        "squareFeet": 2000,
        "propertyType": "house",
        "status": "active",
        "images": [...],
        "videos": [],
        "createdAt": "2025-01-15T10:00:00Z",
        "updatedAt": "2025-01-15T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

---

### 3. **Get Property by ID**

Retrieve a single property.

**Endpoint**: `GET /api/properties/:id`

**Example**:
```
GET /api/properties/prop_abc123
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "property": {
      "id": "prop_abc123",
      "userId": "user_123",
      "title": "Beautiful 3BR House in Downtown",
      "description": "...",
      "address": { ... },
      "price": 450000,
      "bedrooms": 3,
      "bathrooms": 2,
      "squareFeet": 2000,
      "propertyType": "house",
      "status": "draft",
      "images": [...],
      "videos": [],
      "aiEnhancedDescription": null,
      "aiSuggestedPrice": null,
      "metadata": { ... }
    }
  }
}
```

---

### 4. **Update Property**

Update an existing property.

**Endpoint**: `PUT /api/properties/:id`

**Request Body**:
```json
{
  "userId": "user_123",
  "title": "Updated Title",
  "price": 475000,
  "images": ["https://example.com/new-image.jpg"]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Property updated successfully",
  "data": {
    "property": {
      "id": "prop_abc123",
      "title": "Updated Title",
      "status": "draft"
    }
  }
}
```

---

### 5. **Delete Property**

Delete a property.

**Endpoint**: `DELETE /api/properties/:id?userId=user_123`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Property deleted successfully"
}
```

---

## 🤖 AI Workflow Endpoints

### 6. **Publish Property & Start Workflow**

Publishes property and triggers the AI multi-agent workflow.

**Endpoint**: `POST /api/properties/:id/publish`

**Request Body**:
```json
{
  "userId": "user_123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Property published and AI workflow started successfully",
  "data": {
    "property": {
      "id": "prop_abc123",
      "title": "Beautiful 3BR House in Downtown",
      "status": "active"
    },
    "workflow": {
      "started": true,
      "currentStage": "input_validation",
      "humanInterventionRequired": false
    }
  }
}
```

**Workflow Stages**:
1. `input_validation` - Input Manager validates property data
2. `marketing` - Marketing Agent creates content
3. `lead_management` - Lead Manager qualifies leads
4. `negotiation` - Negotiation Agent analyzes offers
5. `legal` - Legal Agent prepares documents
6. `closure` - Closure Agent coordinates closing
7. `completed` - Workflow finished

---

### 7. **Get Workflow Status**

Get current workflow status for a property.

**Endpoint**: `GET /api/properties/:id/workflow`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "propertyId": "prop_abc123",
    "currentStage": "marketing",
    "completed": false,
    "humanInterventionRequired": false,
    "startedAt": "2025-01-15T10:00:00Z",
    "completedAt": null,
    "error": null,
    "agentOutputs": {
      "input_manager": {
        "agentName": "Input Manager",
        "timestamp": "2025-01-15T10:00:10Z",
        "success": true,
        "data": {
          "validationPassed": true,
          "qualityScore": 92,
          "readyForMarketing": true
        },
        "nextAction": "Proceed to Marketing Agent"
      },
      "marketing": {
        "agentName": "Marketing Agent V2",
        "timestamp": "2025-01-15T10:00:30Z",
        "success": true,
        "data": {
          "contentGenerated": true,
          "primaryVoice": "storytelling",
          "platformsTargeted": ["facebook", "instagram", "linkedin", "twitter"]
        }
      }
    }
  }
}
```

---

### 8. **Resume Workflow**

Resume workflow after human intervention.

**Endpoint**: `POST /api/properties/:id/workflow/resume`

**Request Body**:
```json
{
  "userId": "user_123",
  "updatedProperty": true,
  "humanInterventionResolved": true
}
```

**Example Use Case**:
Property failed validation (quality score < 85%). User fixed missing fields. Now resume workflow.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Workflow resumed successfully",
  "data": {
    "propertyId": "prop_abc123",
    "currentStage": "marketing",
    "completed": false,
    "humanInterventionRequired": false,
    "error": null
  }
}
```

---

### 9. **Get Workflow History**

Get complete workflow execution history (all checkpoints).

**Endpoint**: `GET /api/properties/:id/workflow/history`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "propertyId": "prop_abc123",
    "totalCheckpoints": 3,
    "history": [
      {
        "timestamp": "2025-01-15T10:00:10Z",
        "stage": "input_validation",
        "humanInterventionRequired": false,
        "agentOutputs": {
          "input_manager": { ... }
        }
      },
      {
        "timestamp": "2025-01-15T10:00:30Z",
        "stage": "marketing",
        "humanInterventionRequired": false,
        "agentOutputs": {
          "marketing": { ... }
        }
      },
      {
        "timestamp": "2025-01-15T10:01:00Z",
        "stage": "lead_management",
        "humanInterventionRequired": false,
        "agentOutputs": {
          "lead_manager": { ... }
        }
      }
    ]
  }
}
```

---

## 🔒 Authentication

**Current**: Simplified (userId in request body/query params)

**Production TODO**:
- Implement JWT authentication
- Add middleware for token validation
- Use Supabase Auth for user sessions

**Headers** (Future):
```
Authorization: Bearer <jwt_token>
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Missing required field: title"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized: User ID required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Unauthorized: You do not own this property"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Property not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 📝 Example Usage Flow

### Complete Workflow Example

**Step 1**: Create property
```bash
curl -X POST http://localhost:3000/api/properties \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "title": "Beautiful 3BR House",
    "description": "Spacious family home...",
    "address": {
      "street": "123 Main St",
      "city": "Austin",
      "state": "TX",
      "zipCode": "78701",
      "country": "USA"
    },
    "price": 450000,
    "bedrooms": 3,
    "bathrooms": 2,
    "squareFeet": 2000,
    "propertyType": "house",
    "images": ["https://example.com/image1.jpg"]
  }'
```

**Step 2**: Publish property (trigger AI workflow)
```bash
curl -X POST http://localhost:3000/api/properties/prop_abc123/publish \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_123"}'
```

**Step 3**: Check workflow status
```bash
curl http://localhost:3000/api/properties/prop_abc123/workflow
```

**Step 4** (if needed): Resume workflow
```bash
curl -X POST http://localhost:3000/api/properties/prop_abc123/workflow/resume \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "humanInterventionResolved": true
  }'
```

**Step 5**: View workflow history
```bash
curl http://localhost:3000/api/properties/prop_abc123/workflow/history
```

---

## 🚀 Next Steps

1. **Add Authentication**: Implement JWT/Supabase Auth
2. **Add Rate Limiting**: Protect endpoints from abuse
3. **Add Pagination**: For large property lists
4. **Add Webhooks**: Notify external systems of workflow events
5. **Add GraphQL**: Alternative to REST for complex queries

---

## 📚 Related Documentation

- [AI Agents Implementation](./AI_AGENTS_IMPLEMENTATION.md)
- [Architecture Guide](../ARCHITECTURE.md)
- [Supabase Setup](../SUPABASE_SETUP.md)
