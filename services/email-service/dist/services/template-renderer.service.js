"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateRenderer = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("../utils/logger.service");
let TemplateRenderer = class TemplateRenderer {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    async renderEmailTemplate(message, correlationId) {
        const startTime = Date.now();
        try {
            this.logger.logWithCorrelation('info', 'template_render_start', correlationId, {
                template_code: message.template_code,
                notification_id: message.notification_id,
            });
            const { template_data, variables, user_data } = message;
            const subject = this.interpolateTemplate(template_data.subject || 'Notification', {
                ...variables,
                user: user_data,
            });
            const html = this.interpolateTemplate(template_data.content, {
                ...variables,
                user: user_data,
            });
            const text = this.htmlToText(html);
            const emailContent = {
                to: user_data.email,
                subject,
                html,
                text,
            };
            const processingTime = Date.now() - startTime;
            this.logger.logPerformance('template_render', processingTime, true, correlationId);
            this.logger.logWithCorrelation('info', 'template_render_success', correlationId, {
                template_code: message.template_code,
                notification_id: message.notification_id,
                processing_time_ms: processingTime,
            });
            return emailContent;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.logger.logPerformance('template_render', processingTime, false, correlationId);
            this.logger.error('template_render_failed', error, {
                template_code: message.template_code,
                notification_id: message.notification_id,
                correlation_id: correlationId,
                processing_time_ms: processingTime,
            });
            throw error;
        }
    }
    interpolateTemplate(template, variables) {
        try {
            return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
                const value = this.getNestedValue(variables, key.trim());
                return value !== undefined ? String(value) : match;
            });
        }
        catch (error) {
            this.logger.error('template_interpolation_failed', error, {
                template_snippet: template.substring(0, 100),
                variables: Object.keys(variables),
            });
            throw error;
        }
    }
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && typeof current === 'object' ? current[key] : undefined;
        }, obj);
    }
    htmlToText(html) {
        try {
            return html
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();
        }
        catch (error) {
            this.logger.error('html_to_text_failed', error);
            return html;
        }
    }
    validateTemplate(templateData) {
        try {
            if (!templateData.content || templateData.content.trim() === '') {
                return false;
            }
            const openBraces = (templateData.content.match(/\{\{/g) || []).length;
            const closeBraces = (templateData.content.match(/\}\}/g) || []).length;
            if (openBraces !== closeBraces) {
                this.logger.warn('template_validation_unbalanced_braces', {
                    template_code: templateData.code,
                    open_braces: openBraces,
                    close_braces: closeBraces,
                });
                return false;
            }
            return true;
        }
        catch (error) {
            this.logger.error('template_validation_failed', error, {
                template_code: templateData.code,
            });
            return false;
        }
    }
    extractVariables(template) {
        try {
            const matches = template.match(/\{\{([^}]+)\}\}/g);
            if (!matches)
                return [];
            return [
                ...new Set(matches.map((match) => match.replace(/\{\{|\}\}/g, '').trim())),
            ];
        }
        catch (error) {
            this.logger.error('extract_variables_failed', error);
            return [];
        }
    }
};
exports.TemplateRenderer = TemplateRenderer;
exports.TemplateRenderer = TemplateRenderer = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], TemplateRenderer);
//# sourceMappingURL=template-renderer.service.js.map