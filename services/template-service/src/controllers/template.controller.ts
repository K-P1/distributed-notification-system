import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { TemplateService } from '../services/template.service';
import { LoggerService } from '../utils/logger.service';
import type {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateSearchParams,
  CreateTemplateVersionRequest,
  TemplateRenderRequest,
  ApiResponse,
} from '../types';

interface CorrelationInterceptor {}

@Controller('templates')
@UseInterceptors(/* CorrelationInterceptor would go here */)
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly logger: LoggerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Body() request: CreateTemplateRequest,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-user-id') userId?: string,
  ): Promise<ApiResponse<Template>> {
    const userIdValue = userId || 'system';

    this.logger.info('template_controller_create_request', {
      code: request.code,
      type: request.type,
      userId: userIdValue,
      correlationId,
    });

    return await this.templateService.createTemplate(
      request,
      userIdValue,
      correlationId,
    );
  }

  @Get(':id')
  async getTemplate(
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ApiResponse<Template>> {
    this.logger.info('template_controller_get_request', {
      templateId: id,
      correlationId,
    });

    return await this.templateService.getTemplate(id, correlationId);
  }

  @Get('code/:code')
  async getTemplateByCode(
    @Param('code') code: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ApiResponse<Template>> {
    this.logger.info('template_controller_get_by_code_request', {
      code,
      correlationId,
    });

    return await this.templateService.getTemplateByCode(code, correlationId);
  }

  @Get()
  async searchTemplates(
    @Query('type') type?: string,
    @Query('language') language?: string,
    @Query('tags') tags?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<
    ApiResponse<{
      templates: Template[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>
  > {
    const searchParams: TemplateSearchParams = {
      type,
      language,
      tags: tags ? tags.split(',') : undefined,
      isActive: isActive ? isActive === 'true' : undefined,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    };

    this.logger.info('template_controller_search_request', {
      params: searchParams,
      correlationId,
    });

    return await this.templateService.searchTemplates(
      searchParams,
      correlationId,
    );
  }

  @Put(':id')
  async updateTemplate(
    @Param('id') id: string,
    @Body() request: UpdateTemplateRequest,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-user-id') userId?: string,
  ): Promise<ApiResponse<Template>> {
    const userIdValue = userId || 'system';

    this.logger.info('template_controller_update_request', {
      templateId: id,
      userId: userIdValue,
      correlationId,
    });

    return await this.templateService.updateTemplate(
      id,
      request,
      userIdValue,
      correlationId,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<void> {
    this.logger.info('template_controller_delete_request', {
      templateId: id,
      correlationId,
    });

    await this.templateService.deleteTemplate(id, correlationId);
  }

  @Get(':id/versions')
  async getTemplateVersions(
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    this.logger.info('template_controller_get_versions_request', {
      templateId: id,
      correlationId,
    });

    return await this.templateService.getTemplateVersions(id, correlationId);
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  async createTemplateVersion(
    @Param('id') id: string,
    @Body() request: CreateTemplateVersionRequest,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const userIdValue = userId || 'system';

    this.logger.info('template_controller_create_version_request', {
      templateId: id,
      userId: userIdValue,
      correlationId,
    });

    return await this.templateService.createTemplateVersion(
      id,
      request,
      userIdValue,
      correlationId,
    );
  }

  @Post(':id/versions/:version/activate')
  @HttpCode(HttpStatus.OK)
  async activateTemplateVersion(
    @Param('id') id: string,
    @Param('version') version: string,
    @Headers('x-correlation-id') correlationId?: string,
    @Headers('x-user-id') userId?: string,
  ) {
    const userIdValue = userId || 'system';
    const versionNumber = parseInt(version);

    this.logger.info('template_controller_activate_version_request', {
      templateId: id,
      version: versionNumber,
      userId: userIdValue,
      correlationId,
    });

    return await this.templateService.activateTemplateVersion(
      id,
      versionNumber,
      userIdValue,
      correlationId,
    );
  }

  @Post('render/:code')
  @HttpCode(HttpStatus.OK)
  async renderTemplate(
    @Param('code') code: string,
    @Body() variables: Record<string, any>,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    this.logger.info('template_controller_render_request', {
      templateCode: code,
      variableCount: Object.keys(variables).length,
      correlationId,
    });

    return await this.templateService.renderTemplate(
      code,
      variables,
      correlationId,
    );
  }

  @Get('active/all')
  async getActiveTemplates(
    @Query('type') type?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    this.logger.info('template_controller_get_active_request', {
      type,
      correlationId,
    });

    return await this.templateService.getActiveTemplates(type, correlationId);
  }

  @Get('stats/overview')
  async getTemplateStats(@Headers('x-correlation-id') correlationId?: string) {
    this.logger.info('template_controller_get_stats_request', {
      correlationId,
    });

    return await this.templateService.getTemplateStats(correlationId);
  }

  @Get('validate/code/:code')
  async checkCodeAvailability(
    @Param('code') code: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    this.logger.info('template_controller_check_code_request', {
      code,
      correlationId,
    });

    return await this.templateService.checkCodeAvailability(
      code,
      correlationId,
    );
  }
}
