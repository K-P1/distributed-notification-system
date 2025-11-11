import { Injectable } from '@nestjs/common';
import { LoggerService } from '../utils/logger.service';
import type { NotificationMessage, TemplateData, EmailContent } from '../types';

@Injectable()
export class TemplateRenderer {
  constructor(private readonly logger: LoggerService) {}

  async renderEmailTemplate(
    message: NotificationMessage,
    correlationId: string,
  ): Promise<EmailContent> {
    const startTime = Date.now();

    try {
      this.logger.logWithCorrelation(
        'info',
        'template_render_start',
        correlationId,
        {
          template_code: message.template_code,
          notification_id: message.notification_id,
        },
      );

      const { template_data, variables, user_data } = message;

      // Render subject
      const subject = this.interpolateTemplate(
        template_data.subject || 'Notification',
        {
          ...variables,
          user: user_data,
        },
      );

      // Render HTML content
      const html = this.interpolateTemplate(template_data.content, {
        ...variables,
        user: user_data,
      });

      // Create plain text version from HTML
      const text = this.htmlToText(html);

      const emailContent: EmailContent = {
        to: user_data.email,
        subject,
        html,
        text,
      };

      const processingTime = Date.now() - startTime;
      this.logger.logPerformance(
        'template_render',
        processingTime,
        true,
        correlationId,
      );

      this.logger.logWithCorrelation(
        'info',
        'template_render_success',
        correlationId,
        {
          template_code: message.template_code,
          notification_id: message.notification_id,
          processing_time_ms: processingTime,
        },
      );

      return emailContent;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.logPerformance(
        'template_render',
        processingTime,
        false,
        correlationId,
      );

      this.logger.error('template_render_failed', error as Error, {
        template_code: message.template_code,
        notification_id: message.notification_id,
        correlation_id: correlationId,
        processing_time_ms: processingTime,
      });

      throw error;
    }
  }

  private interpolateTemplate(
    template: string,
    variables: Record<string, any>,
  ): string {
    try {
      // Simple template interpolation using {{variable}} syntax
      return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const value = this.getNestedValue(variables, key.trim());
        return value !== undefined ? String(value) : match;
      });
    } catch (error) {
      this.logger.error('template_interpolation_failed', error as Error, {
        template_snippet: template.substring(0, 100),
        variables: Object.keys(variables),
      });
      throw error;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  private htmlToText(html: string): string {
    try {
      // Simple HTML to text conversion
      return html
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
        .replace(/&amp;/g, '&') // Replace HTML entities
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
    } catch (error) {
      this.logger.error('html_to_text_failed', error as Error);
      return html; // Return original if conversion fails
    }
  }

  validateTemplate(templateData: TemplateData): boolean {
    try {
      // Basic template validation
      if (!templateData.content || templateData.content.trim() === '') {
        return false;
      }

      // Check for balanced template syntax
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
    } catch (error) {
      this.logger.error('template_validation_failed', error as Error, {
        template_code: templateData.code,
      });
      return false;
    }
  }

  extractVariables(template: string): string[] {
    try {
      const matches = template.match(/\{\{([^}]+)\}\}/g);
      if (!matches) return [];

      return [
        ...new Set(
          matches.map((match) => match.replace(/\{\{|\}\}/g, '').trim()),
        ),
      ];
    } catch (error) {
      this.logger.error('extract_variables_failed', error as Error);
      return [];
    }
  }
}
