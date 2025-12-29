// Tipos compartilhados do Aura System

export type UserRole = "ADMIN" | "MANAGER" | "USER" | "VIEWER";
export type Plan = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
export type LeadSource = "WEBSITE" | "REFERRAL" | "SOCIAL_MEDIA" | "COLD_CALL" | "EMAIL" | "EVENT" | "OTHER";
export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "CANCELLED";
export type SaleStatus = "PENDING" | "CONFIRMED" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: UserRole;
  isActive: boolean;
  company?: Company | null;
  createdAt: Date;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  plan: Plan;
}

export interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  value: number | null;
  notes: string | null;
  assignedTo?: User | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: Date | null;
  assignedTo?: User | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  cost: number | null;
  stock: number;
  minStock: number;
  isActive: boolean;
  category?: Category | null;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

export interface Sale {
  id: string;
  number: string;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  paidAt: Date | null;
  lead?: Lead | null;
  items: SaleItem[];
  createdAt: Date;
}

export interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product: Product;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link: string | null;
  createdAt: Date;
}

export interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  user: User;
  lead?: Lead | null;
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardStats {
  leads: {
    total: number;
    won: number;
    lost: number;
    conversionRate: string;
  };
  tasks: {
    total: number;
    done: number;
    pending: number;
    completionRate: string;
  };
  products: {
    total: number;
    lowStock: number;
  };
  sales: {
    total: number;
    revenue: number;
  };
}

