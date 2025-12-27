# Refactor: Eliminar Sellers, Solo Brokers

## 🎯 Objetivo
Simplificar el modelo de negocio eliminando la lógica de "sellers" como usuarios. Solo brokers son clientes que pagan.

## 📊 Cambios en el Modelo de Datos

### **Property Entity**

**Antes:**
```typescript
interface PropertyData {
  userId: string;  // Generic (seller o broker)
  // ...
}
```

**Después:**
```typescript
interface PropertyData {
  brokerId: string;  // Always a broker (who owns the listing)

  // Seller info como metadata (no user)
  seller: {
    name: string;
    email: string;
    phone: string;
    notes?: string;
  };

  // ...existing fields
}
```

### **Database Schema Changes**

**Supabase migrations necesarios:**

```sql
-- 1. Rename userId to brokerId
ALTER TABLE properties
  RENAME COLUMN user_id TO broker_id;

-- 2. Add seller_info JSONB column
ALTER TABLE properties
  ADD COLUMN seller_info JSONB DEFAULT '{}'::jsonb;

-- Ejemplo de seller_info structure:
-- {
--   "name": "María García",
--   "email": "maria@example.com",
--   "phone": "+52 55 1234 5678",
--   "notes": "Motivated seller, relocating to Guadalajara"
-- }

-- 3. Update existing records (si hay data)
-- Esto dependerá de tu data actual
```

---

## 📁 Archivos a Modificar

### **1. Domain Layer**

#### **src/domain/entities/Property.ts**
- ✅ Cambiar `userId` → `brokerId`
- ✅ Agregar `seller: SellerInfo` interface
- ✅ Actualizar métodos si es necesario

```typescript
export interface SellerInfo {
  name: string;
  email: string;
  phone: string;
  notes?: string;
}

export interface PropertyData {
  id: string;
  brokerId: string;  // ← Changed from userId

  // Seller info (metadata, not a user)
  seller: SellerInfo;  // ← New

  title: string;
  description: string | null;
  address: Address;
  price: number;
  // ...existing fields
}
```

---

### **2. Repository Layer**

#### **src/domain/repositories/IPropertyRepository.ts**
- ✅ Métodos ya usan generic `userId`, solo documentar que es `brokerId`

```typescript
export interface IPropertyRepository {
  // userId es en realidad brokerId
  findByUserId(userId: string): Promise<Property[]>;  // Find broker's properties
  // ...
}
```

---

#### **src/infrastructure/database/supabase/SupabasePropertyRepository.ts**
- ✅ Actualizar queries para usar `broker_id`
- ✅ Mapear `seller_info` JSONB

```typescript
async create(property: Property): Promise<void> {
  const data = property.toJSON();

  const { error } = await this.supabase
    .from('properties')
    .insert({
      id: data.id,
      broker_id: data.brokerId,  // ← Changed
      seller_info: data.seller,  // ← New
      title: data.title,
      // ...
    });

  if (error) throw new Error(error.message);
}

async findByUserId(brokerId: string): Promise<Property[]> {
  const { data, error } = await this.supabase
    .from('properties')
    .select('*')
    .eq('broker_id', brokerId);  // ← Changed from user_id

  if (error) throw new Error(error.message);

  return (data || []).map(this.mapToProperty);
}

private mapToProperty(row: any): Property {
  return new Property({
    id: row.id,
    brokerId: row.broker_id,  // ← Changed
    seller: row.seller_info || {},  // ← New
    title: row.title,
    // ...
  });
}
```

---

### **3. Use Cases**

#### **src/application/use-cases/property/CreateProperty.ts**
- ✅ Renombrar parámetros si es necesario
- ✅ Agregar `seller` info al input

```typescript
interface CreatePropertyInput {
  brokerId: string;  // ← Clarify this is broker

  seller: {  // ← New
    name: string;
    email: string;
    phone: string;
    notes?: string;
  };

  title: string;
  description: string;
  address: Address;
  price: number;
  // ...existing fields
}

export class CreatePropertyUseCase {
  async execute(input: CreatePropertyInput): Promise<Property> {
    const property = new Property({
      id: uuid(),
      brokerId: input.brokerId,  // ← Changed
      seller: input.seller,  // ← New
      title: input.title,
      description: input.description,
      address: input.address,
      price: input.price,
      // ...
      status: PropertyStatus.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.propertyRepository.create(property);
    return property;
  }
}
```

---

### **4. API Routes**

#### **app/api/properties/route.ts** (Create Property)

**Antes:**
```typescript
POST /api/properties
{
  userId: "user_123",  // Generic
  title: "Casa en Polanco",
  // ...
}
```

**Después:**
```typescript
POST /api/properties
{
  brokerId: "broker_123",  // Explicit

  seller: {  // New
    name: "María García",
    email: "maria@example.com",
    phone: "+52 55 1234 5678",
    notes: "Motivated seller"
  },

  title: "Casa en Polanco",
  description: "...",
  address: {...},
  price: 5000000,
  bedrooms: 3,
  bathrooms: 2,
  // ...
}
```

**Code changes:**
```typescript
export async function POST(request: NextRequest) {
  const body = await request.json();

  const {
    brokerId,  // ← Changed from userId
    seller,    // ← New
    title,
    description,
    address,
    price,
    // ...
  } = body;

  // Validation
  if (!brokerId) {
    return NextResponse.json(
      { success: false, error: 'Broker ID is required' },
      { status: 400 }
    );
  }

  if (!seller || !seller.name || !seller.email) {
    return NextResponse.json(
      { success: false, error: 'Seller info (name, email) is required' },
      { status: 400 }
    );
  }

  const property = await createPropertyUseCase.execute({
    brokerId,
    seller,
    title,
    // ...
  });

  return NextResponse.json({ success: true, data: property });
}
```

---

#### **app/api/properties/GET** (List Properties)
- ✅ Ya filtra por `userId`, solo renombrar internamente a `brokerId`

---

### **5. Frontend**

#### **app/properties/new/page.tsx** (Create Property Form)

**Agregar campos de seller:**

```tsx
'use client';

import { useState } from 'react';

export default function NewPropertyPage() {
  const [formData, setFormData] = useState({
    // Property info
    title: '',
    description: '',
    price: '',
    bedrooms: '',
    bathrooms: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'Mexico',
    },

    // Seller info (NEW)
    seller: {
      name: '',
      email: '',
      phone: '',
      notes: '',
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // TODO: Get brokerId from auth session
    const brokerId = 'broker_current_user';

    const response = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brokerId,
        seller: formData.seller,
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseInt(formData.bathrooms),
        address: formData.address,
        propertyType: 'house',
        images: [],
        videos: [],
      }),
    });

    const result = await response.json();

    if (result.success) {
      alert('Property created!');
      // Redirect to property page
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Add New Property</h1>

      {/* Seller Information Section */}
      <div className="mb-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Seller Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Seller Name *
            </label>
            <input
              type="text"
              required
              value={formData.seller.name}
              onChange={(e) => setFormData({
                ...formData,
                seller: { ...formData.seller, name: e.target.value }
              })}
              className="w-full px-3 py-2 border rounded"
              placeholder="María García"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Seller Email *
            </label>
            <input
              type="email"
              required
              value={formData.seller.email}
              onChange={(e) => setFormData({
                ...formData,
                seller: { ...formData.seller, email: e.target.value }
              })}
              className="w-full px-3 py-2 border rounded"
              placeholder="maria@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Seller Phone *
            </label>
            <input
              type="tel"
              required
              value={formData.seller.phone}
              onChange={(e) => setFormData({
                ...formData,
                seller: { ...formData.seller, phone: e.target.value }
              })}
              className="w-full px-3 py-2 border rounded"
              placeholder="+52 55 1234 5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={formData.seller.notes}
              onChange={(e) => setFormData({
                ...formData,
                seller: { ...formData.seller, notes: e.target.value }
              })}
              className="w-full px-3 py-2 border rounded"
              rows={3}
              placeholder="Motivated seller, relocating soon..."
            />
          </div>
        </div>
      </div>

      {/* Property Information Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Property Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Property Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="Beautiful House in Polanco"
            />
          </div>

          {/* ... rest of property fields */}
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700"
      >
        Create Property
      </button>
    </form>
  );
}
```

---

#### **app/dashboard/page.tsx** (Dashboard)
- ✅ Ya muestra properties del user actual
- ✅ Solo actualizar labels si es necesario ("Your Properties" → "Your Listings")

---

### **6. AI Agents (NO cambios mayores)**

Los agents NO necesitan cambios porque ya trabajan con `Property` entity:

- ✅ **Input Manager Agent** - Valida property data
- ✅ **Marketing Agent** - Genera content basado en property
- ✅ **Lead Manager Agent** - Trabaja leads para property
- ✅ **Negotiation Agent** - Analiza offers para property
- ✅ **Legal Agent** - Genera contratos (ahora puede usar `property.seller`)
- ✅ **Closure Agent** - Finaliza venta

**Único cambio potencial:**

```typescript
// LegalAgent.ts - puede usar seller info ahora

async execute(state) {
  const property = await getProperty(state.propertyId);

  // Generate contract with seller info
  const contract = await this.generateContract({
    seller: property.seller,  // ← Now available
    buyer: state.buyerInfo,
    property: property,
    price: state.agreedPrice,
  });

  // ...
}
```

---

## 🗂️ Archivos que NO necesitan cambios

✅ **Workflow (PropertySalesWorkflow.ts)** - Trabaja con property ID, no le importa si es seller/broker
✅ **WorkflowState.ts** - State ya usa `propertyId`, no `userId`
✅ **BaseAgent.ts** - Generic, no usa user info
✅ **Tools (messaging.ts, calendar.ts, document.ts)** - Generic
✅ **MCPToolLoader.ts** - No depende de user model

---

## 📋 Checklist de Implementación

### **Phase 1: Database Migration**
- [ ] Crear migration en Supabase
- [ ] Rename `user_id` → `broker_id`
- [ ] Add `seller_info` JSONB column
- [ ] Test migration en dev

### **Phase 2: Domain & Repository**
- [ ] Update `Property.ts` entity
- [ ] Update `SupabasePropertyRepository.ts`
- [ ] Update use cases (CreateProperty, etc.)

### **Phase 3: API Layer**
- [ ] Update POST /api/properties
- [ ] Update GET /api/properties
- [ ] Test endpoints con Postman

### **Phase 4: Frontend**
- [ ] Update `app/properties/new/page.tsx` con seller fields
- [ ] Update dashboard labels si es necesario
- [ ] Test full flow: Create → View → Publish

### **Phase 5: AI Agents (Optional)**
- [ ] Update LegalAgent para usar `property.seller`
- [ ] Update ClosureAgent si necesita seller contact

### **Phase 6: Testing**
- [ ] Create property con seller info
- [ ] Publish property
- [ ] Run full workflow
- [ ] Verify seller info aparece en Legal/Closure stages

---

## 🎯 Expected Result

### **Antes:**
```
User (role: seller o broker) → Property
```

### **Después:**
```
Broker (cliente pagador) → Property → Seller (metadata)
```

### **Property object final:**
```typescript
{
  id: "prop_123",
  brokerId: "broker_current_user",

  seller: {
    name: "María García",
    email: "maria@example.com",
    phone: "+52 55 1234 5678",
    notes: "Motivated seller, relocating to Guadalajara"
  },

  title: "Beautiful House in Polanco",
  description: "3 bed, 2 bath, modern finishes",
  address: {
    street: "Polanco 123",
    city: "Ciudad de México",
    state: "CDMX",
    zipCode: "11560",
    country: "Mexico"
  },
  price: 5000000,
  bedrooms: 3,
  bathrooms: 2,
  propertyType: "house",
  status: "active",
  images: [...],
  videos: [],
  createdAt: "2025-12-26T10:00:00Z",
  updatedAt: "2025-12-26T10:00:00Z"
}
```

---

## 🚀 Post-Refactor Features

Una vez refactorizado, podemos agregar features específicas para brokers:

1. **Broker Profile**
   - Company name
   - License number
   - Bio/expertise
   - Photo

2. **Subscription Tiers**
   - Solo: $200/mes (5 properties)
   - Pro: $400/mes (20 properties, CRM sync)
   - Enterprise: $800/mes (unlimited, team)

3. **Multi-Property Dashboard**
   - Ver todas mis properties
   - Filter por status (active, sold, etc.)
   - Analytics (total leads, conversion rate, etc.)

4. **CRM Integration** (Phase 2)
   - Import leads from Follow Up Boss
   - Sync bidirectional
   - Auto-match leads to properties

---

**Status:** Ready to implement
**Priority:** High (blocker para MVP real)
**Estimated Time:** 4-6 hours de refactor
