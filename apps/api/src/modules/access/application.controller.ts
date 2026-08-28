import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common'
import { hasPermission, type SigapRequest } from '../shared/index.js'
import { CreateApplicationDto, UpdateApplicationDto } from './access.dto.js'
import { ApplicationService } from './application.service.js'

/**
 * FR-B-001 · the application registry write side.
 *
 * Read (`GET /applications`) already lives on CampaignController because it is
 * also step 1 of the campaign wizard. The writes live here, gated on
 * `application:write` (SEC_OFFICER) -- registering and maintaining the registry
 * is an operator responsibility, and the permission is the same one the
 * FRD Sec 1.4 matrix assigns.
 */
@Controller()
export class ApplicationController {
  constructor(private readonly applications: ApplicationService) {}

  /** Employees for the owner / tech-owner pickers on the registry form. */
  @Get('employees')
  async employees(@Req() req: SigapRequest) {
    this.require(req, 'application:write')
    return { data: await this.applications.listEmployeesForPicker(req.principal!) }
  }

  @Post('applications')
  @HttpCode(201)
  async create(@Req() req: SigapRequest, @Body() dto: CreateApplicationDto) {
    this.require(req, 'application:write')
    const result = await this.applications.create(req.principal!, {
      code: dto.code,
      name: dto.name,
      ownerEmployeeId: dto.owner_employee_id,
      techOwnerEmployeeId: dto.tech_owner_employee_id ?? null,
      criticality: dto.criticality,
      hostingType: dto.hosting_type,
      reviewFrequency: dto.review_frequency,
    })
    return { data: { id: result.id, code: dto.code } }
  }

  @Patch('applications/:id')
  @HttpCode(204)
  async update(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    this.require(req, 'application:write')
    await this.applications.update(req.principal!, id, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.owner_employee_id !== undefined ? { ownerEmployeeId: dto.owner_employee_id } : {}),
      ...(dto.tech_owner_employee_id !== undefined
        ? { techOwnerEmployeeId: dto.tech_owner_employee_id }
        : {}),
      ...(dto.criticality !== undefined ? { criticality: dto.criticality } : {}),
      ...(dto.hosting_type !== undefined ? { hostingType: dto.hosting_type } : {}),
      ...(dto.review_frequency !== undefined ? { reviewFrequency: dto.review_frequency } : {}),
    })
  }

  @Post('applications/:id/deactivate')
  @HttpCode(204)
  async deactivate(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'application:write')
    await this.applications.deactivate(req.principal!, id)
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      throw new ForbiddenException('Anda tidak memiliki hak untuk tindakan ini.')
    }
  }
}
