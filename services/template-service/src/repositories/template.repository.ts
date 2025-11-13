import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../infrastructure/database.service';
import { CacheService } from '../infrastructure/cache.service';
import { LoggerService } from '../utils/logger.service';
import {
  Template,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateSearchParams,
  TemplateVersion,
  CreateTemplateVersionRequest,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TemplateRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly cache: CacheService,
    private readonly logger: LoggerService,
  ) {}

  async create(
    request: CreateTemplateRequest,
    userId: string,
    correlationId?: string,
  ): Promise<Template> {
    try {
      const templateId = uuidv4();
      const now = new Date();

      // Insert template
      const result = await this.database.query<Template>(
        `
        INSERT INTO templates (
          id, code, name, description, type, subject, content, 
          variables, language, tags, metadata, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
        `,
        [
          templateId,
          request.code,
          request.name,
          request.description,
          request.type,
          request.subject,
          request.content,
          request.variables || [],
          request.language || 'en',
          request.tags || [],
          request.metadata || {},
          userId,
          userId,
        ],
        correlationId,
      );

      if (!result.length) {
        throw new Error('Failed to create template');
      }

      const template = result[0];

      // Create initial version
      await this.database.query(
        `
        INSERT INTO template_versions (
          template_id, version, subject, content, variables, 
          is_active, created_by, change_log, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          templateId,
          1,
          request.subject,
          request.content,
          request.variables || [],
          true,
          userId,
          'Initial version',
          request.metadata || {},
        ],
        correlationId,
      );

      // Cache the template
      await this.cache.setTemplate(template.code, template);

      this.logger.info('template_created', {
        templateId: template.id,
        code: template.code,
        type: template.type,
        correlationId,
      });

      return template;
    } catch (error) {
      this.logger.error('template_creation_failed', error as Error, {
        code: request.code,
        type: request.type,
        correlationId,
      });
      throw error;
    }
  }

  async findById(id: string, correlationId?: string): Promise<Template | null> {
    try {
      const result = await this.database.query<Template>(
        'SELECT * FROM templates WHERE id = $1',
        [id],
        correlationId,
      );

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      this.logger.error('template_find_by_id_failed', error as Error, {
        templateId: id,
        correlationId,
      });
      return null;
    }
  }

  async findByCode(
    code: string,
    correlationId?: string,
  ): Promise<Template | null> {
    try {
      // Try cache first
      const cached = await this.cache.getTemplate(code);
      if (cached) {
        return cached;
      }

      // Fallback to database
      const result = await this.database.query<Template>(
        'SELECT * FROM templates WHERE code = $1',
        [code],
        correlationId,
      );

      const template = result.length > 0 ? result[0] : null;

      // Cache the result
      if (template) {
        await this.cache.setTemplate(code, template);
      }

      return template;
    } catch (error) {
      this.logger.error('template_find_by_code_failed', error as Error, {
        code,
        correlationId,
      });
      return null;
    }
  }

  async search(
    params: TemplateSearchParams,
    correlationId?: string,
  ): Promise<{
    templates: Template[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        type,
        language,
        tags,
        isActive,
        search,
        page = 1,
        limit = 20,
      } = params;

      const offset = (page - 1) * limit;
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      // Build WHERE conditions
      if (type) {
        paramCount++;
        conditions.push(`type = $${paramCount}`);
        values.push(type);
      }

      if (language) {
        paramCount++;
        conditions.push(`language = $${paramCount}`);
        values.push(language);
      }

      if (isActive !== undefined) {
        paramCount++;
        conditions.push(`is_active = $${paramCount}`);
        values.push(isActive);
      }

      if (tags && tags.length > 0) {
        paramCount++;
        conditions.push(`tags && $${paramCount}`);
        values.push(tags);
      }

      if (search) {
        paramCount++;
        conditions.push(`(
          name ILIKE $${paramCount} OR 
          description ILIKE $${paramCount} OR 
          code ILIKE $${paramCount}
        )`);
        values.push(`%${search}%`);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count total records
      const countResult = await this.database.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM templates ${whereClause}`,
        values,
        correlationId,
      );

      const total = parseInt(countResult[0]?.count || '0');

      // Get paginated results
      paramCount++;
      values.push(limit);
      paramCount++;
      values.push(offset);

      const templates = await this.database.query<Template>(
        `
        SELECT * FROM templates 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `,
        values,
        correlationId,
      );

      const totalPages = Math.ceil(total / limit);

      return {
        templates,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error('template_search_failed', error as Error, {
        params,
        correlationId,
      });
      throw error;
    }
  }

  async update(
    id: string,
    request: UpdateTemplateRequest,
    userId: string,
    correlationId?: string,
  ): Promise<Template | null> {
    try {
      // First get the current template
      const current = await this.findById(id, correlationId);
      if (!current) {
        return null;
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      // Build dynamic update query
      if (request.name !== undefined) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        values.push(request.name);
      }

      if (request.description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        values.push(request.description);
      }

      if (request.subject !== undefined) {
        paramCount++;
        updateFields.push(`subject = $${paramCount}`);
        values.push(request.subject);
      }

      if (request.content !== undefined) {
        paramCount++;
        updateFields.push(`content = $${paramCount}`);
        values.push(request.content);
      }

      if (request.variables !== undefined) {
        paramCount++;
        updateFields.push(`variables = $${paramCount}`);
        values.push(request.variables);
      }

      if (request.language !== undefined) {
        paramCount++;
        updateFields.push(`language = $${paramCount}`);
        values.push(request.language);
      }

      if (request.isActive !== undefined) {
        paramCount++;
        updateFields.push(`is_active = $${paramCount}`);
        values.push(request.isActive);
      }

      if (request.tags !== undefined) {
        paramCount++;
        updateFields.push(`tags = $${paramCount}`);
        values.push(request.tags);
      }

      if (request.metadata !== undefined) {
        paramCount++;
        updateFields.push(`metadata = $${paramCount}`);
        values.push(request.metadata);
      }

      if (updateFields.length === 0) {
        return current; // No updates
      }

      // Add updated_by
      paramCount++;
      updateFields.push(`updated_by = $${paramCount}`);
      values.push(userId);

      // Add version increment
      paramCount++;
      updateFields.push(`version = $${paramCount}`);
      values.push(current.version + 1);

      // Add WHERE condition
      paramCount++;
      values.push(id);

      const result = await this.database.query<Template>(
        `
        UPDATE templates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
        `,
        values,
        correlationId,
      );

      if (!result.length) {
        return null;
      }

      const updatedTemplate = result[0];

      // Create new version if content changed
      if (request.content !== undefined || request.subject !== undefined) {
        await this.database.query(
          `
          INSERT INTO template_versions (
            template_id, version, subject, content, variables,
            is_active, created_by, change_log, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            id,
            updatedTemplate.version,
            updatedTemplate.subject,
            updatedTemplate.content,
            updatedTemplate.variables,
            true,
            userId,
            request.changeLog || 'Template updated',
            updatedTemplate.metadata,
          ],
          correlationId,
        );

        // Deactivate previous versions
        await this.database.query(
          `
          UPDATE template_versions 
          SET is_active = false 
          WHERE template_id = $1 AND version < $2
          `,
          [id, updatedTemplate.version],
          correlationId,
        );
      }

      // Update cache
      await this.cache.setTemplate(updatedTemplate.code, updatedTemplate);

      this.logger.info('template_updated', {
        templateId: id,
        code: updatedTemplate.code,
        version: updatedTemplate.version,
        correlationId,
      });

      return updatedTemplate;
    } catch (error) {
      this.logger.error('template_update_failed', error as Error, {
        templateId: id,
        correlationId,
      });
      throw error;
    }
  }

  async delete(id: string, correlationId?: string): Promise<boolean> {
    try {
      // Get template before deletion for cache cleanup
      const template = await this.findById(id, correlationId);
      if (!template) {
        return false;
      }

      const result = await this.database.query(
        'DELETE FROM templates WHERE id = $1',
        [id],
        correlationId,
      );

      // Remove from cache
      await this.cache.invalidateTemplate(template.code);

      this.logger.info('template_deleted', {
        templateId: id,
        code: template.code,
        correlationId,
      });

      return true;
    } catch (error) {
      this.logger.error('template_deletion_failed', error as Error, {
        templateId: id,
        correlationId,
      });
      return false;
    }
  }

  async getVersions(
    templateId: string,
    correlationId?: string,
  ): Promise<TemplateVersion[]> {
    try {
      const result = await this.database.query<TemplateVersion>(
        `
        SELECT * FROM template_versions 
        WHERE template_id = $1 
        ORDER BY version DESC
        `,
        [templateId],
        correlationId,
      );

      return result;
    } catch (error) {
      this.logger.error('template_versions_fetch_failed', error as Error, {
        templateId,
        correlationId,
      });
      return [];
    }
  }

  async createVersion(
    templateId: string,
    request: CreateTemplateVersionRequest,
    userId: string,
    correlationId?: string,
  ): Promise<TemplateVersion | null> {
    try {
      const template = await this.findById(templateId, correlationId);
      if (!template) {
        return null;
      }

      const newVersion = template.version + 1;

      // Create new version
      const result = await this.database.query<TemplateVersion>(
        `
        INSERT INTO template_versions (
          template_id, version, subject, content, variables,
          is_active, created_by, change_log, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
        `,
        [
          templateId,
          newVersion,
          request.subject,
          request.content,
          request.variables || template.variables,
          false, // New versions start inactive
          userId,
          request.changeLog || 'New version created',
          request.metadata || {},
        ],
        correlationId,
      );

      if (!result.length) {
        throw new Error('Failed to create template version');
      }

      this.logger.info('template_version_created', {
        templateId,
        version: newVersion,
        correlationId,
      });

      return result[0];
    } catch (error) {
      this.logger.error('template_version_creation_failed', error as Error, {
        templateId,
        correlationId,
      });
      throw error;
    }
  }

  async activateVersion(
    templateId: string,
    version: number,
    userId: string,
    correlationId?: string,
  ): Promise<boolean> {
    try {
      return await this.database.transaction(async (client) => {
        // Deactivate all versions
        await client.query(
          'UPDATE template_versions SET is_active = false WHERE template_id = $1',
          [templateId],
        );

        // Activate the specified version
        await client.query(
          'UPDATE template_versions SET is_active = true WHERE template_id = $1 AND version = $2',
          [templateId, version],
        );

        // Get the version data
        const versionResult = await client.query(
          'SELECT * FROM template_versions WHERE template_id = $1 AND version = $2',
          [templateId, version],
        );

        if (!versionResult.rows.length) {
          throw new Error('Version not found');
        }

        const versionData = versionResult.rows[0];

        // Update the main template with this version's data
        await client.query(
          `
          UPDATE templates 
          SET subject = $1, content = $2, variables = $3, version = $4, updated_by = $5
          WHERE id = $6
          `,
          [
            versionData.subject,
            versionData.content,
            versionData.variables,
            version,
            userId,
            templateId,
          ],
        );

        return true;
      }, correlationId);
    } catch (error) {
      this.logger.error('template_version_activation_failed', error as Error, {
        templateId,
        version,
        correlationId,
      });
      return false;
    }
  }

  async getActiveTemplates(
    type?: string,
    correlationId?: string,
  ): Promise<Template[]> {
    try {
      let query = 'SELECT * FROM templates WHERE is_active = true';
      const values: any[] = [];

      if (type) {
        query += ' AND type = $1';
        values.push(type);
      }

      query += ' ORDER BY name';

      const result = await this.database.query<Template>(
        query,
        values,
        correlationId,
      );
      return result;
    } catch (error) {
      this.logger.error('active_templates_fetch_failed', error as Error, {
        type,
        correlationId,
      });
      return [];
    }
  }

  async getTemplateStats(correlationId?: string): Promise<{
    total: number;
    active: number;
    byType: Record<string, number>;
    byLanguage: Record<string, number>;
  }> {
    try {
      const [totalResult, activeResult, typeResult, languageResult] =
        await Promise.all([
          this.database.query<{ count: string }>(
            'SELECT COUNT(*) as count FROM templates',
            [],
            correlationId,
          ),
          this.database.query<{ count: string }>(
            'SELECT COUNT(*) as count FROM templates WHERE is_active = true',
            [],
            correlationId,
          ),
          this.database.query<{ type: string; count: string }>(
            'SELECT type, COUNT(*) as count FROM templates GROUP BY type',
            [],
            correlationId,
          ),
          this.database.query<{ language: string; count: string }>(
            'SELECT language, COUNT(*) as count FROM templates GROUP BY language',
            [],
            correlationId,
          ),
        ]);

      const byType: Record<string, number> = {};
      typeResult.forEach((row) => {
        byType[row.type] = parseInt(row.count);
      });

      const byLanguage: Record<string, number> = {};
      languageResult.forEach((row) => {
        byLanguage[row.language] = parseInt(row.count);
      });

      return {
        total: parseInt(totalResult[0]?.count || '0'),
        active: parseInt(activeResult[0]?.count || '0'),
        byType,
        byLanguage,
      };
    } catch (error) {
      this.logger.error('template_stats_fetch_failed', error as Error, {
        correlationId,
      });
      return {
        total: 0,
        active: 0,
        byType: {},
        byLanguage: {},
      };
    }
  }
}
