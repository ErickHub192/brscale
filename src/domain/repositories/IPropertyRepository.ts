// Repository Interface - Dependency Inversion Principle
// Domain layer defines the interface, infrastructure implements it

import { Property, PropertyData } from '../entities/Property';

export interface IPropertyRepository {
    findById(id: string): Promise<Property | null>;
    findByUserId(userId: string): Promise<Property[]>;
    findAll(): Promise<Property[]>;
    create(data: Omit<PropertyData, 'id' | 'createdAt' | 'updatedAt'>): Promise<Property>;
    update(id: string, data: Partial<PropertyData>): Promise<Property>;
    delete(id: string): Promise<void>;
}
