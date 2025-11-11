import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { TemplateRepository } from '../repositories/template.repository';
import { TemplateValidationService } from './validation.service';
import { LoggerService } from '../utils/logger.service';
import {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateSearchParams,
  TemplateVersion,
  CreateTemplateVersionRequest,
  TemplateRenderRequest,
  TemplateRenderResult,
  ApiResponse,
} from '../types';

@Injectable()
export class TemplateService {
  constructor(
    private readonly repository: TemplateRepository,
    private readonly validation: TemplateValidationService,
    private readonly logger: LoggerService,
  ) {}

  async createTemplate(
    request: CreateTemplateRequest,
    userId: string,
    correlationId?: string,
  ): Promise<ApiResponse<Template>> {
    try {
      // Validate request
      const validationErrors = this.validation.validateCreateRequest(request);

      // Validate that variables match content
      if (request.variables && request.variables.length > 0) {
        const templateErrors = this.validation.validateTemplateVariables(
          request.content,
          request.subject,
          request.variables,
        );
        validationErrors.push(...templateErrors);
      } else {
        // Auto-extract variables if not provided
        request.variables = this.validation.extractVariables(request.content);
        if (request.subject) {
          const subjectVars = this.validation.extractVariables(request.subject);
          request.variables = [
            ...new Set([...request.variables, ...subjectVars]),
          ];
        }
      }

      this.validation.validateAndThrow(validationErrors);

      // Check if template code already exists
      const existing = await this.repository.findByCode(
        request.code,
        correlationId,
      );
      if (existing) {
        throw new ConflictException(
          `Template with code '${request.code}' already exists`,
        );
      }

      // Sanitize input
      request.name = this.validation.sanitizeInput(request.name);
      request.description = request.description
        ? this.validation.sanitizeInput(request.description)
        : undefined;

      const template = await this.repository.create(
        request,
        userId,
        correlationId,
      );

      this.logger.info('template_service_created', {
        templateId: template.id,
        code: template.code,
        type: template.type,
        userId,
        correlationId,
      });

      return {
        success: true,
        data: template,
        message: 'Template created successfully',
      };
    } catch (error) {
      this.logger.error('template_service_creation_failed', error as Error, {
        code: request.code,
        userId,
        correlationId,
      });

      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new Error('Failed to create template');
    }
  }

  async getTemplate(
    id: string,
    correlationId?: string,
  ): Promise<ApiResponse<Template>> {
    try {
      const template = await this.repository.findById(id, correlationId);

      if (!template) {
        throw new NotFoundException(`Template with ID '${id}' not found`);
      }

      return {
        success: true,
        data: template,
        message: 'Template retrieved successfully',
      };
    } catch (error) {
      this.logger.error('template_service_get_failed', error as Error, {
        templateId: id,
        correlationId,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new Error('Failed to retrieve template');
    }
  }

  async getTemplateByCode(
    code: string,
    correlationId?: string,
  ): Promise<ApiResponse<Template>> {
    try {
      const template = await this.repository.findByCode(code, correlationId);

      if (!template) {
        throw new NotFoundException(`Template with code '${code}' not found`);
      }

      return {
        success: true,
        data: template,
        message: 'Template retrieved successfully',
      };
    } catch (error) {
      this.logger.error('template_service_get_by_code_failed', error as Error, {
        code,
        correlationId,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new Error('Failed to retrieve template');
    }
  }

  async searchTemplates(
    params: TemplateSearchParams,
    correlationId?: string,
  ): Promise<
    ApiResponse<{
      templates: Template[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  > {
    try {
      // Validate pagination parameters
      if (params.page && params.page < 1) {
        throw new BadRequestException('Page must be greater than 0');
      }

      if (params.limit && (params.limit < 1 || params.limit > 100)) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }

      const result = await this.repository.search(params, correlationId);

      return {
        success: true,
        data: result,
        message: 'Templates retrieved successfully',
      };
    } catch (error) {
      this.logger.error('template_service_search_failed', error as Error, {
        params,
        correlationId,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new Error('Failed to search templates');
    }
  }

  async updateTemplate(
    id: string,
    request: UpdateTemplateRequest,
    userId: string,
    correlationId?: string,
  ): Promise<ApiResponse<Template>> {
    try {
      // Get existing template for validation
      const existing = await this.repository.findById(id, correlationId);
      if (!existing) {
        throw new NotFoundException(`Template with ID '${id}' not found`);
      }

      // Validate request
      const validationErrors = this.validation.validateUpdateRequest(request);

      // If content or subject is being updated, validate variables
      if (
        request.content !== undefined ||
        request.subject !== undefined ||
        request.variables !== undefined
      ) {
        const content = request.content ?? existing.content;
        const subject = request.subject ?? existing.subject;
        const variables = request.variables ?? existing.variables;

        if (variables && variables.length > 0) {
          const templateErrors = this.validation.validateTemplateVariables(
            content,
            subject,
            variables,
          );
          validationErrors.push(...templateErrors);
        } else {
          // Auto-extract variables
          request.variables = this.validation.extractVariables(content);
          if (subject) {
            const subjectVars = this.validation.extractVariables(subject);
            request.variables = [
              ...new Set([...request.variables, ...subjectVars]),
            ];
          }
        }
      }

      this.validation.validateAndThrow(validationErrors);

      // Sanitize input
      if (request.name) {
        request.name = this.validation.sanitizeInput(request.name);
      }
      if (request.description) {
        request.description = this.validation.sanitizeInput(
          request.description,
        );
      }

      const template = await this.repository.update(
        id,
        request,
        userId,
        correlationId,
      );

      if (!template) {
        throw new NotFoundException(`Template with ID '${id}' not found`);
      }

      this.logger.info('template_service_updated', {
        templateId: id,
        code: template.code,
        version: template.version,
        userId,
        correlationId,
      });

      return {
        success: true,
        data: template,
        message: 'Template updated successfully',
      };
    } catch (error) {
      this.logger.error('template_service_update_failed', error as Error, {
        templateId: id,
        userId,
        correlationId,
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new Error('Failed to update template');
    }
  }

  async deleteTemplate(
    id: string,
    correlationId?: string,
  ): Promise<ApiResponse<null>> {
    try {
      const success = await this.repository.delete(id, correlationId);

      if (!success) {
        throw new NotFoundException(`Template with ID '${id}' not found`);
      }

      this.logger.info('template_service_deleted', {
        templateId: id,
        correlationId,
      });

      return {
        success: true,
        data: null,
        message: 'Template deleted successfully',
      };
    } catch (error) {
      this.logger.error('template_service_deletion_failed', error as Error, {
        templateId: id,
        correlationId,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new Error('Failed to delete template');
    }
  }

  async getTemplateVersions(
    templateId: string,
    correlationId?: string,
  ): Promise<ApiResponse<TemplateVersion[]>> {
    try {
      // Verify template exists
      const template = await this.repository.findById(
        templateId,
        correlationId,
      );
      if (!template) {
        throw new NotFoundException(
          `Template with ID '${templateId}' not found`,
        );
      }

      const versions = await this.repository.getVersions(
        templateId,
        correlationId,
      );

      return {
        success: true,
        data: versions,
        message: 'Template versions retrieved successfully',
      };
    } catch (error) {
      this.logger.error('template_service_versions_failed', error as Error, {
        templateId,
        correlationId,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new Error('Failed to retrieve template versions');
    }
  }

  async createTemplateVersion(
    templateId: string,
    request: CreateTemplateVersionRequest,
    userId: string,
    correlationId?: string,
  ): Promise<ApiResponse<TemplateVersion>> {
    try {
      // Get existing template
      const template = await this.repository.findById(
        templateId,
        correlationId,
      );
      if (!template) {
        throw new NotFoundException(
          `Template with ID '${templateId}' not found`,
        );
      }

      // Validate content matches template type
      const validationErrors: any[] = [];

      if (template.type === 'email') {
        validationErrors.push(
          ...this.validation.validateEmailContent(
            request.content,
            request.subject,
          ),
        );

        if (!request.subject || request.subject.trim().length === 0) {
          validationErrors.push({
            field: 'subject',
            message: 'Subject is required for email templates',
            value: request.subject,
          });
        }
      } else if (template.type === 'push') {
        validationErrors.push(
          ...this.validation.validatePushContent(request.content),
        );
      }

      // Validate variables
      if (request.variables && request.variables.length > 0) {
        validationErrors.push(
          ...this.validation.validateVariables(request.variables),
        );
        validationErrors.push(
          ...this.validation.validateTemplateVariables(
            request.content,
            request.subject,
            request.variables,
          ),
        );
      } else {
        // Auto-extract variables
        request.variables = this.validation.extractVariables(request.content);
        if (request.subject) {
          const subjectVars = this.validation.extractVariables(request.subject);
          request.variables = [
            ...new Set([...request.variables, ...subjectVars]),
          ];
        }
      }

      this.validation.validateAndThrow(validationErrors);

      const version = await this.repository.createVersion(
        templateId,
        request,
        userId,
        correlationId,
      );

      if (!version) {
        throw new Error('Failed to create template version');
      }

      this.logger.info('template_version_service_created', {
        templateId,
        version: version.version,
        userId,
        correlationId,
      });

      return {
        success: true,
        data: version,
        message: 'Template version created successfully',
      };
    } catch (error) {
      this.logger.error(
        'template_version_service_creation_failed',
        error as Error,
        {
          templateId,
          userId,
          correlationId,
        },
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new Error('Failed to create template version');
    }
  }

  async activateTemplateVersion(
    templateId: string,
    version: number,
    userId: string,
    correlationId?: string,
  ): Promise<ApiResponse<null>> {
    try {
      const success = await this.repository.activateVersion(
        templateId,
        version,
        userId,
        correlationId,
      );

      if (!success) {
        throw new NotFoundException(
          `Template version ${version} not found for template ${templateId}`,
        );
      }

      this.logger.info('template_version_service_activated', {
        templateId,
        version,
        userId,
        correlationId,
      });

      return {
        success: true,
        data: null,
        message: 'Template version activated successfully',
      };
    } catch (error) {
      this.logger.error(
        'template_version_service_activation_failed',
        error as Error,
        {
          templateId,
          version,
          userId,
          correlationId,
        },
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new Error('Failed to activate template version');
    }
  }

  async renderTemplate(
    code: string,
    variables: Record<string, any>,
    correlationId?: string,
  ): Promise<ApiResponse<TemplateRenderResult>> {
    try {
      const template = await this.repository.findByCode(code, correlationId);

      if (!template) {
        throw new NotFoundException(`Template with code '${code}' not found`);
      }

      if (!template.is_active) {
        throw new BadRequestException(`Template '${code}' is not active`);
      }

      // Validate that all required variables are provided
      const missingVariables = template.variables.filter(
        (variable) =>
          variables[variable] === undefined || variables[variable] === null,
      );

      if (missingVariables.length > 0) {
        throw new BadRequestException(
          `Missing required variables: ${missingVariables.join(', ')}`,
        );
      }

      // Render content
      let renderedContent = template.content;
      let renderedSubject = template.subject;

      // Replace variables in content
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        renderedContent = renderedContent.replace(regex, String(value));

        if (renderedSubject) {
          renderedSubject = renderedSubject.replace(regex, String(value));
        }
      }

      // Check for any unreplaced variables (security check)
      const unreplacedVars = this.validation.extractVariables(renderedContent);
      if (renderedSubject) {
        unreplacedVars.push(
          ...this.validation.extractVariables(renderedSubject),
        );
      }

      if (unreplacedVars.length > 0) {
        this.logger.warn('template_render_unreplaced_variables', {
          templateCode: code,
          unreplacedVars,
          correlationId,
        });
      }

      const result: TemplateRenderResult = {
        content: renderedContent,
        subject: renderedSubject,
        type: template.type as any,
        templateId: template.id,
        templateCode: template.code,
        templateVersion: template.version,
        variables: template.variables,
        language: template.language,
      };

      this.logger.info('template_service_rendered', {
        templateCode: code,
        templateId: template.id,
        version: template.version,
        correlationId,
      });

      return {
        success: true,
        data: result,
        message: 'Template rendered successfully',
      };
    } catch (error) {
      this.logger.error('template_service_render_failed', error as Error, {
        templateCode: code,
        correlationId,
      });

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new Error('Failed to render template');
    }
  }

  async getActiveTemplates(
    type?: string,
    correlationId?: string,
  ): Promise<ApiResponse<Template[]>> {
    try {
      const templates = await this.repository.getActiveTemplates(
        type,
        correlationId,
      );

      return {
        success: true,
        data: templates,
        message: 'Active templates retrieved successfully',
      };
    } catch (error) {
      this.logger.error(
        'template_service_active_templates_failed',
        error as Error,
        {
          type,
          correlationId,
        },
      );

      throw new Error('Failed to retrieve active templates');
    }
  }

  async getTemplateStats(correlationId?: string): Promise<
    ApiResponse<{
      total: number;
      active: number;
      byType: Record<string, number>;
      byLanguage: Record<string, number>;
    }>
  > {
    try {
      const stats = await this.repository.getTemplateStats(correlationId);

      return {
        success: true,
        data: stats,
        message: 'Template statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('template_service_stats_failed', error as Error, {
        correlationId,
      });

      throw new Error('Failed to retrieve template statistics');
    }
  }

  async validateTemplateCode(code: string): Promise<boolean> {
    return this.validation.validateTemplateCode(code);
  }

  async checkCodeAvailability(
    code: string,
    correlationId?: string,
  ): Promise<ApiResponse<{ available: boolean }>> {
    try {
      if (!this.validation.validateTemplateCode(code)) {
        return {
          success: false,
          data: { available: false },
          message: 'Invalid template code format',
        };
      }

      const existing = await this.repository.findByCode(code, correlationId);

      return {
        success: true,
        data: { available: !existing },
        message: existing
          ? 'Template code is already in use'
          : 'Template code is available',
      };
    } catch (error) {
      this.logger.error('template_service_code_check_failed', error as Error, {
        code,
        correlationId,
      });

      throw new Error('Failed to check template code availability');
    }
  }
}
