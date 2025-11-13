import { LoggerService } from '../utils/logger.service';
import type { NotificationMessage, TemplateData, EmailContent } from '../types';
export declare class TemplateRenderer {
    private readonly logger;
    constructor(logger: LoggerService);
    renderEmailTemplate(message: NotificationMessage, correlationId: string): Promise<EmailContent>;
    private interpolateTemplate;
    private getNestedValue;
    private htmlToText;
    validateTemplate(templateData: TemplateData): boolean;
    extractVariables(template: string): string[];
}
