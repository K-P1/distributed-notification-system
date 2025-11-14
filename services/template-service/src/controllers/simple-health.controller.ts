import { Controller, Get, HttpStatus } from '@nestjs/common';

@Controller()
export class SimpleHealthController {
  private readonly startTime = Date.now();

  @Get('api/v1/health/simple')
  getSimpleHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      service: 'template-service',
    };
  }

  @Get('health')
  getBasicHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  getRoot() {
    return {
      service: 'Template Service',
      version: process.env.VERSION || '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };
  }
}
