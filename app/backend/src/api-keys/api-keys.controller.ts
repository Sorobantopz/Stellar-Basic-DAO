import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CursorPaginationQueryDto } from '../dto/pagination/pagination.dto';
import { RequireScopes } from '../auth/decorators/require-scopes.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@ApiTags('api-keys')
@Controller('api-keys')
// Every route here manages credentials, so a verified API key is mandatory.
// Without the guard, the endpoints were reachable with only a spoofable
// x-organization-role header and an attacker could mint/revoke/rotate keys.
//
// Role authorization is expressed via @RequireScopes('admin') rather than
// @RequireOrgRole: ApiKeyGuard derives the role from the key's scopes after
// validation, but the global OrganizationRoleGuard runs BEFORE ApiKeyGuard
// (when organizationContext.role is still 'read_only'), so any admin role
// check there would reject every caller, valid keys included.
@UseGuards(ApiKeyGuard)
// Every route here manages credentials or exposes key/usage data, so a
// verified admin-scoped API key is mandatory for the whole controller.
@RequireScopes('admin')
export class ApiKeysController {
  constructor(private readonly service: ApiKeysService) {}

  /**
   * POST /api-keys
   * Creates a new API key. The raw key is returned ONCE in the response.
   * The key is always scoped to the caller's organization.
   */
  @Post()
  create(@Body() dto: CreateApiKeyDto, @Req() req: Request) {
    return this.service.create(dto, req.organizationContext?.organizationId);
  }

  /**
   * GET /api-keys
   * Lists all active keys (masked) with cursor-based pagination. Optionally filter by owner_id.
   */
  @Get()
  @ApiOperation({ summary: 'List API keys with cursor-based pagination' })
  @ApiQuery({ name: 'owner_id', required: false })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque pagination cursor' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (1-100)' })
  @ApiResponse({ status: 200, description: 'Paginated list of API keys' })
  list(
    @Req() req: Request,
    @Query('owner_id') ownerId?: string,
    @Query() pagination?: CursorPaginationQueryDto,
  ) {
    return this.service.listPaginated(
      ownerId,
      req.organizationContext?.organizationId,
      pagination?.cursor,
      pagination?.limit,
    );
  }

  /**
   * GET /api-keys/usage
   * Returns aggregated usage/quota stats.
   */
  @Get('usage')
  usage(@Req() req: Request, @Query('owner_id') ownerId?: string) {
    return this.service.getUsage(ownerId, req.organizationContext?.organizationId);
  }

  /**
   * DELETE /api-keys/:id
   * Revokes (soft-deletes) a key.
   */
  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.revoke(id, req.organizationContext?.organizationId);
  }

  /**
   * POST /api-keys/:id/rotate
   * Invalidates the current key and issues a new one.
   */
  @Post(':id/rotate')
  rotate(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.rotate(id, req.organizationContext?.organizationId);
  }
}
