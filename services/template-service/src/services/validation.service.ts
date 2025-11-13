import { Injectable, BadRequestException } from '@nestjs/common';
import { LoggerService } from '../utils/logger.service';
import {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ValidationError,
  TemplateType,
} from '../types';

@Injectable()
export class TemplateValidationService {
  private readonly codeRegex = /^[a-zA-Z0-9_-]+$/;
  private readonly variableRegex = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g;
  private readonly htmlTagRegex = /<[^>]*>/g;

  constructor(private readonly logger: LoggerService) {}

  validateCreateRequest(request: CreateTemplateRequest): ValidationError[] {
    const errors: ValidationError[] = [];

    // Code validation
    if (!request.code || request.code.trim().length === 0) {
      errors.push({
        field: 'code',
        message: 'Code is required',
        value: request.code,
      });
    } else if (!this.codeRegex.test(request.code)) {
      errors.push({
        field: 'code',
        message:
          'Code can only contain letters, numbers, underscores, and hyphens',
        value: request.code,
      });
    } else if (request.code.length > 255) {
      errors.push({
        field: 'code',
        message: 'Code cannot be longer than 255 characters',
        value: request.code,
      });
    }

    // Name validation
    if (!request.name || request.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Name is required',
        value: request.name,
      });
    } else if (request.name.length > 500) {
      errors.push({
        field: 'name',
        message: 'Name cannot be longer than 500 characters',
        value: request.name,
      });
    }

    // Type validation
    if (!request.type) {
      errors.push({
        field: 'type',
        message: 'Type is required',
        value: request.type,
      });
    } else if (
      !Object.values(TemplateType).includes(request.type as TemplateType)
    ) {
      errors.push({
        field: 'type',
        message: 'Type must be email or push',
        value: request.type,
      });
    }

    // Content validation
    if (!request.content || request.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Content is required',
        value: request.content,
      });
    } else {
      // Validate content based on type
      if (request.type === TemplateType.EMAIL) {
        errors.push(
          ...this.validateEmailContent(request.content, request.subject),
        );
      } else if (request.type === TemplateType.PUSH) {
        errors.push(...this.validatePushContent(request.content));
      }
    }

    // Subject validation for email templates
    if (request.type === TemplateType.EMAIL) {
      if (!request.subject || request.subject.trim().length === 0) {
        errors.push({
          field: 'subject',
          message: 'Subject is required for email templates',
          value: request.subject,
        });
      } else if (request.subject.length > 500) {
        errors.push({
          field: 'subject',
          message: 'Subject cannot be longer than 500 characters',
          value: request.subject,
        });
      }
    }

    // Variables validation
    if (request.variables) {
      errors.push(...this.validateVariables(request.variables));
    }

    // Language validation
    if (request.language && !/^[a-z]{2}(-[A-Z]{2})?$/.test(request.language)) {
      errors.push({
        field: 'language',
        message: 'Language must be in format "en" or "en-US"',
        value: request.language,
      });
    }

    // Description validation
    if (request.description && request.description.length > 2000) {
      errors.push({
        field: 'description',
        message: 'Description cannot be longer than 2000 characters',
        value: request.description,
      });
    }

    // Tags validation
    if (request.tags) {
      for (let i = 0; i < request.tags.length; i++) {
        const tag = request.tags[i];
        if (!tag || tag.trim().length === 0) {
          errors.push({
            field: `tags[${i}]`,
            message: 'Tag cannot be empty',
            value: tag,
          });
        } else if (tag.length > 50) {
          errors.push({
            field: `tags[${i}]`,
            message: 'Tag cannot be longer than 50 characters',
            value: tag,
          });
        }
      }

      if (request.tags.length > 20) {
        errors.push({
          field: 'tags',
          message: 'Cannot have more than 20 tags',
          value: request.tags,
        });
      }
    }

    return errors;
  }

  validateUpdateRequest(request: UpdateTemplateRequest): ValidationError[] {
    const errors: ValidationError[] = [];

    // Name validation
    if (request.name !== undefined) {
      if (request.name.trim().length === 0) {
        errors.push({
          field: 'name',
          message: 'Name cannot be empty',
          value: request.name,
        });
      } else if (request.name.length > 500) {
        errors.push({
          field: 'name',
          message: 'Name cannot be longer than 500 characters',
          value: request.name,
        });
      }
    }

    // Content validation
    if (request.content !== undefined) {
      if (request.content.trim().length === 0) {
        errors.push({
          field: 'content',
          message: 'Content cannot be empty',
          value: request.content,
        });
      }
      // Note: We can't validate email vs push content here without knowing the template type
    }

    // Subject validation
    if (request.subject !== undefined && request.subject.length > 500) {
      errors.push({
        field: 'subject',
        message: 'Subject cannot be longer than 500 characters',
        value: request.subject,
      });
    }

    // Variables validation
    if (request.variables !== undefined) {
      errors.push(...this.validateVariables(request.variables));
    }

    // Language validation
    if (
      request.language !== undefined &&
      !/^[a-z]{2}(-[A-Z]{2})?$/.test(request.language)
    ) {
      errors.push({
        field: 'language',
        message: 'Language must be in format "en" or "en-US"',
        value: request.language,
      });
    }

    // Description validation
    if (
      request.description !== undefined &&
      request.description.length > 2000
    ) {
      errors.push({
        field: 'description',
        message: 'Description cannot be longer than 2000 characters',
        value: request.description,
      });
    }

    // Tags validation
    if (request.tags !== undefined) {
      for (let i = 0; i < request.tags.length; i++) {
        const tag = request.tags[i];
        if (!tag || tag.trim().length === 0) {
          errors.push({
            field: `tags[${i}]`,
            message: 'Tag cannot be empty',
            value: tag,
          });
        } else if (tag.length > 50) {
          errors.push({
            field: `tags[${i}]`,
            message: 'Tag cannot be longer than 50 characters',
            value: tag,
          });
        }
      }

      if (request.tags.length > 20) {
        errors.push({
          field: 'tags',
          message: 'Cannot have more than 20 tags',
          value: request.tags,
        });
      }
    }

    return errors;
  }

  validateEmailContent(content: string, subject?: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for basic HTML structure if it's HTML content
    if (content.includes('<html') || content.includes('<!DOCTYPE')) {
      // Validate HTML structure
      const hasHtmlTag = content.includes('<html');
      const hasBodyTag = content.includes('<body');
      const hasClosingHtml = content.includes('</html>');
      const hasClosingBody = content.includes('</body>');

      if (hasHtmlTag && !hasClosingHtml) {
        errors.push({
          field: 'content',
          message: 'HTML content missing closing </html> tag',
          value: content.substring(0, 100),
        });
      }

      if (hasBodyTag && !hasClosingBody) {
        errors.push({
          field: 'content',
          message: 'HTML content missing closing </body> tag',
          value: content.substring(0, 100),
        });
      }
    }

    // Check for potentially dangerous content
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /onclick\s*=/gi,
      /onload\s*=/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push({
          field: 'content',
          message: 'Content contains potentially unsafe HTML',
          value: content.substring(0, 100),
        });
        break;
      }
    }

    // Validate subject if provided
    if (subject) {
      // Check for template variables in subject
      const subjectVariables = this.extractVariables(subject);
      const contentVariables = this.extractVariables(content);

      for (const variable of subjectVariables) {
        if (!contentVariables.includes(variable)) {
          errors.push({
            field: 'subject',
            message: `Subject uses variable '${variable}' which is not used in content`,
            value: subject,
          });
        }
      }
    }

    return errors;
  }

  validatePushContent(content: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Push notifications should be plain text
    if (this.htmlTagRegex.test(content)) {
      errors.push({
        field: 'content',
        message: 'Push notification content should not contain HTML tags',
        value: content,
      });
    }

    // Check length (typical push notification limits)
    if (content.length > 1000) {
      errors.push({
        field: 'content',
        message: 'Push notification content is too long (max 1000 characters)',
        value: content,
      });
    }

    return errors;
  }

  validateVariables(variables: string[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];

      // Check if variable name is valid
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable)) {
        errors.push({
          field: `variables[${i}]`,
          message:
            'Variable name must start with a letter and contain only letters, numbers, and underscores',
          value: variable,
        });
      }

      // Check for duplicates
      if (seen.has(variable)) {
        errors.push({
          field: `variables[${i}]`,
          message: `Duplicate variable name: ${variable}`,
          value: variable,
        });
      }
      seen.add(variable);

      // Check variable length
      if (variable.length > 50) {
        errors.push({
          field: `variables[${i}]`,
          message: 'Variable name cannot be longer than 50 characters',
          value: variable,
        });
      }
    }

    return errors;
  }

  validateTemplateVariables(
    content: string,
    subject: string | undefined,
    declaredVariables: string[],
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Extract variables from content and subject
    const usedVariables = new Set<string>();

    // Extract from content
    const contentVariables = this.extractVariables(content);
    contentVariables.forEach((v) => usedVariables.add(v));

    // Extract from subject
    if (subject) {
      const subjectVariables = this.extractVariables(subject);
      subjectVariables.forEach((v) => usedVariables.add(v));
    }

    // Check if all used variables are declared
    for (const variable of usedVariables) {
      if (!declaredVariables.includes(variable)) {
        errors.push({
          field: 'variables',
          message: `Variable '${variable}' is used in template but not declared in variables list`,
          value: variable,
        });
      }
    }

    // Check if all declared variables are used
    for (const variable of declaredVariables) {
      if (!usedVariables.has(variable)) {
        errors.push({
          field: 'variables',
          message: `Variable '${variable}' is declared but not used in template`,
          value: variable,
        });
      }
    }

    return errors;
  }

  extractVariables(text: string): string[] {
    const variables: string[] = [];
    let match;

    while ((match = this.variableRegex.exec(text)) !== null) {
      variables.push(match[1]);
    }

    // Reset regex for next use
    this.variableRegex.lastIndex = 0;

    return [...new Set(variables)]; // Remove duplicates
  }

  validateAndThrow(errors: ValidationError[]): void {
    if (errors.length > 0) {
      const errorMessage = errors
        .map((e) => `${e.field}: ${e.message}`)
        .join(', ');
      this.logger.warn('validation_failed', { errors });
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
        error: 'Bad Request',
      });
    }
  }

  sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  validateTemplateCode(code: string): boolean {
    return this.codeRegex.test(code) && code.length > 0 && code.length <= 255;
  }

  validateVariableName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && name.length <= 50;
  }

  validateLanguageCode(language: string): boolean {
    return /^[a-z]{2}(-[A-Z]{2})?$/.test(language);
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
