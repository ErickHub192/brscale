// Property Entity - Core business logic for properties

export interface PropertyData {
    id: string;
    userId: string;
    title: string;
    description: string | null;
    address: Address;
    price: number;
    bedrooms: number | null;
    bathrooms: number | null;
    squareFeet: number | null;
    propertyType: PropertyType;
    status: PropertyStatus;
    images: string[];
    videos: string[];
    aiEnhancedDescription: string | null;
    aiSuggestedPrice: number | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: {
        lat: number;
        lng: number;
    };
}

export enum PropertyType {
    HOUSE = 'house',
    APARTMENT = 'apartment',
    CONDO = 'condo',
    TOWNHOUSE = 'townhouse',
    LAND = 'land',
    COMMERCIAL = 'commercial',
}

export enum PropertyStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    UNDER_OFFER = 'under_offer',
    SOLD = 'sold',
    WITHDRAWN = 'withdrawn',
}

export class Property {
    constructor(private data: PropertyData) { }

    get id(): string {
        return this.data.id;
    }

    get title(): string {
        return this.data.title;
    }

    get price(): number {
        return this.data.price;
    }

    get status(): PropertyStatus {
        return this.data.status;
    }

    isActive(): boolean {
        return this.data.status === PropertyStatus.ACTIVE;
    }

    isDraft(): boolean {
        return this.data.status === PropertyStatus.DRAFT;
    }

    canBePublished(): boolean {
        return this.isDraft() && this.hasRequiredFields();
    }

    private hasRequiredFields(): boolean {
        return !!(
            this.data.title &&
            this.data.description &&
            this.data.address &&
            this.data.price &&
            this.data.images.length > 0
        );
    }

    publish(): void {
        if (!this.canBePublished()) {
            throw new Error('Property cannot be published: missing required fields');
        }
        this.data.status = PropertyStatus.ACTIVE;
        this.data.updatedAt = new Date();
    }

    toJSON(): PropertyData {
        return { ...this.data };
    }
}
