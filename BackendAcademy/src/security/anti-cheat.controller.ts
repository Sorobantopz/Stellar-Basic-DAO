import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, ParseArrayPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AntiCheatService } from './anti-cheat.service';
import { CheckSubmissionDto } from './dto/check-submission.dto';
import { AntiCheatResult } from './interfaces/anti-cheat.interface';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';

/** Anti-cheat batch maximum size */
const ANTI_CHEAT_BATCH_MAX_SIZE = 100;

/**
 * AntiCheatController
 *
 * Exposes HTTP endpoints for triggering AI-based anti-cheat checks.
 * These routes are restricted to admin and trusted grader services.
 *
 * Authentication: JwtAdminGuard + RolesGuard (Admin or Tutor role).
 */
@Controller('security/anti-cheat')
@UseGuards(JwtAdminGuard, RolesGuard)
export class AntiCheatController {
  constructor(private readonly antiCheatService: AntiCheatService) {}

  /**
   * POST /security/anti-cheat/check
   *
   * Analyse a single submission.
   * Restricted to Admin and Tutor roles.
   */
  @Post('check')
  @Roles(UserRole.ADMIN, UserRole.TUTOR)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async check(@Body() dto: CheckSubmissionDto): Promise<AntiCheatResult> {
    return this.antiCheatService.analyzeSubmission(dto);
  }

  /**
   * POST /security/anti-cheat/check-batch
   *
   * Analyse multiple submissions in one request. Batch size limited to
   * {@link ANTI_CHEAT_BATCH_MAX_SIZE} to prevent resource exhaustion.
   * Each array element is validated individually via `@ValidateNested`.
   * Restricted to Admin role only.
   */
  @Post('check-batch')
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async checkBatch(
    @Body(new ParseArrayPipe({
      items: CheckSubmissionDto,
      maxSize: ANTI_CHEAT_BATCH_MAX_SIZE,
    }))
    dtos: CheckSubmissionDto[],
  ): Promise<AntiCheatResult[]> {
    return this.antiCheatService.analyzeSubmissions(dtos);
  }
}
