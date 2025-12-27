# Lead Conversation API Documentation

Este documento describe los endpoints para simular y gestionar conversaciones con leads (compradores potenciales).

## 📋 Endpoints Disponibles

### 1. Enviar Mensaje como Lead

**Endpoint**: `POST /api/properties/:propertyId/leads/message`

Simula un lead (comprador potencial) enviando un mensaje sobre una propiedad.

**Request Body**:
```json
{
  "message": "I'm interested in this property. Can I schedule a viewing?",
  "leadEmail": "john.doe@example.com",
  "leadPhone": "+1234567890",
  "leadName": "John Doe"
}
```

**Campos**:
- `message` (required): El mensaje del lead
- `leadEmail` (optional): Email del lead (se usa como identificador)
- `leadPhone` (optional): Teléfono del lead (se usa como identificador si no hay email)
- `leadName` (optional): Nombre del lead

**Response**:
```json
{
  "success": true,
  "message": "Lead message processed",
  "data": {
    "leadId": "lead_email_john_doe_example_com",
    "agentResponse": "Hi John! I'd be happy to show you this beautiful 3 bed / 2 bath property. I have availability tomorrow at 2 PM or Thursday at 10 AM. Which works better for you?",
    "leadStatus": "active",
    "qualificationScore": 65,
    "readyForOffer": false,
    "workflowAdvanced": false,
    "currentStage": "lead_management"
  }
}
```

**Ejemplo con cURL**:
```bash
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Does the price include appliances?",
    "leadEmail": "buyer@example.com",
    "leadName": "Jane Smith"
  }'
```

---

### 2. Obtener Conversación de un Lead

**Endpoint**: `GET /api/properties/:propertyId/leads/:leadId/conversation`

Obtiene el historial completo de la conversación con un lead específico.

**Response**:
```json
{
  "success": true,
  "data": {
    "leadId": "lead_email_john_doe_example_com",
    "leadName": "John Doe",
    "leadEmail": "john.doe@example.com",
    "status": "qualified",
    "qualificationScore": 75,
    "lastContact": "2025-12-25T10:30:00.000Z",
    "messageCount": 6,
    "messages": [
      {
        "role": "human",
        "content": "I'm interested in this property",
        "timestamp": "2025-12-25T10:00:00.000Z"
      },
      {
        "role": "assistant",
        "content": "Thank you for your interest! This is a beautiful 3 bedroom...",
        "timestamp": "2025-12-25T10:00:05.000Z",
        "agentName": "Lead Manager Agent"
      }
    ]
  }
}
```

**Ejemplo con cURL**:
```bash
curl http://localhost:3000/api/properties/PROPERTY_ID/leads/lead_email_buyer_example_com/conversation
```

---

### 3. Listar Todos los Leads

**Endpoint**: `GET /api/properties/:propertyId/leads`

Lista todos los leads y sus conversaciones para una propiedad.

**Response**:
```json
{
  "success": true,
  "data": {
    "propertyId": "prop_123",
    "currentStage": "lead_management",
    "stats": {
      "totalLeads": 5,
      "activeConversations": 2,
      "qualifiedLeads": 2,
      "readyForOffer": 1,
      "coldLeads": 0,
      "averageQualificationScore": 68
    },
    "leads": [
      {
        "leadId": "lead_email_john_example_com",
        "leadName": "John Doe",
        "leadEmail": "john@example.com",
        "status": "ready_for_offer",
        "qualificationScore": 85,
        "lastContact": "2025-12-25T11:00:00.000Z",
        "messageCount": 8,
        "lastMessage": {
          "role": "human",
          "content": "I'd like to make an offer",
          "timestamp": "2025-12-25T11:00:00.000Z"
        }
      }
    ]
  }
}
```

**Ejemplo con cURL**:
```bash
curl http://localhost:3000/api/properties/PROPERTY_ID/leads
```

---

## 🧪 Escenarios de Prueba

### Escenario 1: Lead Nuevo Haciendo Primera Pregunta

```bash
# 1. Lead envía primera pregunta
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hi, I saw this property online. Is it still available?",
    "leadEmail": "newbuyer@example.com",
    "leadName": "New Buyer"
  }'

# Response esperada:
# - qualificationScore: ~50-60 (primer contacto)
# - status: "active"
# - agentResponse: Confirmación y preguntas adicionales
```

### Escenario 2: Lead Mostrando Alto Interés

```bash
# 2. Lead muestra interés serio
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I love this property! Can we schedule a viewing this week? I have financing pre-approved.",
    "leadEmail": "newbuyer@example.com"
  }'

# Response esperada:
# - qualificationScore: +10 puntos (menciona financiamiento)
# - status: "qualified"
# - agentResponse: Ofrece horarios específicos para visita
```

### Escenario 3: Lead Listo para Hacer Oferta

```bash
# 3. Lead dice que quiere hacer oferta
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to make an offer on this property",
    "leadEmail": "newbuyer@example.com"
  }'

# Response esperada:
# - readyForOffer: true
# - workflowAdvanced: true (avanza a negotiation)
# - currentStage: "negotiation"
```

### Escenario 4: Lead Solo Navegando (Bajo Interés)

```bash
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Just browsing, maybe in 6 months",
    "leadEmail": "browser@example.com"
  }'

# Response esperada:
# - qualificationScore: -5 puntos (timeline lejano)
# - status: "cold" (si score < 30)
```

---

## 🔄 Flujo Completo de Conversación

```bash
# 1. Crear propiedad y empezar workflow
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/publish

# 2. Lead 1 envía mensaje
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I am interested in this property",
    "leadEmail": "lead1@example.com"
  }'

# 3. Lead 1 hace pregunta de seguimiento
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are the HOA fees?",
    "leadEmail": "lead1@example.com"
  }'

# 4. Lead 2 envía mensaje (conversación separada)
curl -X POST http://localhost:3000/api/properties/PROPERTY_ID/leads/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can I schedule a tour?",
    "leadEmail": "lead2@example.com"
  }'

# 5. Ver todas las conversaciones
curl http://localhost:3000/api/properties/PROPERTY_ID/leads

# 6. Ver conversación específica de Lead 1
curl http://localhost:3000/api/properties/PROPERTY_ID/leads/lead_email_lead1_example_com/conversation
```

---

## 📊 Estados de Lead

| Status | Descripción | Qualification Score |
|--------|-------------|-------------------|
| `active` | Conversación activa, sin decisión clara | 30-74 |
| `qualified` | Lead muestra interés serio | 75-84 |
| `ready_for_offer` | Lead listo para hacer oferta | 85+ o explícitamente mencionó oferta |
| `cold` | Bajo interés, timeline lejano | < 30 |
| `waiting_response` | Esperando respuesta del lead | Cualquiera |

---

## 🎯 Qualification Score

El score se ajusta automáticamente basado en la conversación:

**+10 puntos**:
- Menciona "make an offer"
- Menciona "financing approved" o "pre-approved"
- Pregunta sobre next steps

**+5 puntos**:
- Pregunta sobre scheduling
- Pregunta técnicas específicas (HOA, utilities, etc.)
- Menciona timeline cercano (<1 mes)

**0 puntos**:
- Preguntas generales
- Primera interacción

**-5 puntos**:
- "Just browsing"
- Timeline lejano (>3 meses)
- Quejas de precio sin intención de compra

**-10 puntos**:
- "Not interested"
- "Too expensive" sin contraoferta

---

## 🔐 Identificación de Leads

Los leads se identifican automáticamente por:

1. **Email** (preferido): `lead_email_john_example_com`
2. **Teléfono**: `lead_phone_1234567890`
3. **Auto-generado**: `lead_1735156789` (si no hay email ni teléfono)

El mismo lead (mismo email/teléfono) mantendrá la misma conversación a través de múltiples mensajes.

---

## ⚠️ Notas Importantes

1. **Workflow debe estar en `lead_management` stage**: Los mensajes de leads solo se procesan cuando el workflow está en esta etapa.

2. **Multi-turn conversations**: Cada lead puede tener múltiples mensajes. El agente mantiene contexto de toda la conversación.

3. **Automatic advancement**: Cuando un lead dice que quiere hacer oferta, el workflow automáticamente avanza a `negotiation` stage.

4. **Broker override**: El broker puede también enviar mensajes al workflow usando el endpoint `/api/properties/:id/workflow/resume` con `humanRole: "broker"`.
