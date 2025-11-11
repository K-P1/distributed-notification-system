export enum TemplateType {
  EMAIL = 'email',
  PUSH = 'push',
}

export interface Template {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: 'email' | 'push';
  subject?: string;
  content: string;
  variables: string[];
  language: string;
  version: number;
  is_active: boolean;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
  created_by: string;
  updated_by: string;
  metadata?: Record<string, any>;
}

export interface CreateTemplateRequest {
  code: string;
  name: string;
  description?: string;
  type: 'email' | 'push';
  subject?: string;
  content: string;
  variables?: string[];
  language?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  subject?: string;
  content?: string;
  variables?: string[];
  language?: string;
  isActive?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
  changeLog?: string;
}

export interface TemplateSearchParams {
  type?: string;
  language?: string;
  tags?: string[];
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTemplateVersionRequest {
  subject?: string;
  content: string;
  variables?: string[];
  changeLog?: string;
  metadata?: Record<string, any>;
}

export interface TemplateRenderRequest {
  templateCode: string;
  variables: Record<string, any>;
  language?: string;
}

export interface TemplateRenderResult {
  content: string;
  subject?: string;
  type: TemplateType;
  templateId: string;
  templateCode: string;
  templateVersion: number;
  variables: string[];
  language: string;
}

export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  subject?: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: Date;
  created_by: string;
  change_log?: string;
  metadata?: Record<string, any>;
}

export interface TemplateSearchFilters {
  type?: 'email' | 'push';
  language?: string;
  tags?: string[];
  active?: boolean;
  search?: string;
  created_after?: Date;
  created_before?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message: string;
  meta?: any;
}

export interface TemplateValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: TemplateValidationError[];
  warnings: TemplateValidationError[];
  extractedVariables: string[];
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  version: string;
  timestamp: string;
  dependencies: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
  };
  metrics: {
    templates_count: number;
    cache_hit_rate: number;
    average_response_time: number;
  };
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}
