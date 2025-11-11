export interface NotificationMessage {
    notification_id: string;
    request_id: string;
    user_id: string;
    notification_type: 'email' | 'push';
    template_code: string;
    variables: Record<string, any>;
    priority: number;
    timestamp: string;
    user_data: UserData;
    template_data: TemplateData;
}
export interface UserData {
    id: string;
    name: string;
    email: string;
    push_token?: string;
    preferences: UserPreferences;
}
export interface UserPreferences {
    email: boolean;
    push: boolean;
}
export interface TemplateData {
    id: string;
    code: string;
    type: 'email' | 'push';
    subject?: string;
    content: string;
    variables: string[];
    language: string;
    version: number;
}
export interface EmailContent {
    to: string;
    subject: string;
    html: string;
    text: string;
}
export declare enum NotificationStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    DELIVERED = "delivered",
    FAILED = "failed"
}
export interface StatusUpdate {
    notification_id: string;
    status: NotificationStatus;
    timestamp?: string;
    error?: string;
    metadata?: Record<string, any>;
}
export interface HealthCheck {
    status: 'healthy' | 'unhealthy';
    version: string;
    timestamp: string;
    dependencies: {
        rabbitmq: 'healthy' | 'unhealthy';
        smtp: 'healthy' | 'unhealthy';
        redis: 'healthy' | 'unhealthy';
        template_service: 'healthy' | 'unhealthy';
        api_gateway: 'healthy' | 'unhealthy';
    };
    metrics: {
        messages_processed: number;
        messages_failed: number;
        average_processing_time: number;
        queue_length: number;
    };
}
export interface CircuitBreakerOptions {
    threshold: number;
    timeout: number;
    monitor?: boolean;
}
export interface RetryOptions {
    maxRetries: number;
    initialDelay: number;
    exponentialBackoff: boolean;
    maxDelay?: number;
}
