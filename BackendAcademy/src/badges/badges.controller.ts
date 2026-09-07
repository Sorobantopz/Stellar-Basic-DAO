import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BadgesService } from './badges.service';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import type { BadgeListResponse, UserBadgesResponse } from './interfaces/badges.interfaces';

@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  /**
   * Returns all available achievement badges.
   *
   * @example
   *   GET /badges
   *   → { badges: [{ id: "first-login", name: "First Steps", ... }, ...] }
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  getAllBadges(): BadgeListResponse {
    return this.badgesService.getAllBadges();
  }

  /**
   * Returns all badges awarded to a specific user.
   *
   * @param userId  The ID of the user
   *
   * @example
   *   GET /badges/user/user-123
   *   → { userId: "user-123", badges: [{ badge: {...}, awardedAt: "...", nftTokenId: "..." }, ...] }
   */
  @Get('user/:userId')
  @HttpCode(HttpStatus.OK)
  getUserBadges(@Param('userId') userId: string): UserBadgesResponse {
    return this.badgesService.getUserBadges(userId);
  }

  /**
   * Awards a badge to a user.
   * Admin-only internal endpoint with rate limiting.
   *
   * @param awardPayload The payload containing userId, badgeId, and nftTokenId
   *
   * @example
   *   POST /badges/award
   *   → { userId: "user-123", badges: [...] }
   */
  @Post('award')
  @UseGuards(JwtAdminGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  awardBadge(
    @Body()
    awardPayload: { userId: string; badgeId: string; nftTokenId: string },
  ): UserBadgesResponse {
    return this.badgesService.awardBadge(
      awardPayload.userId,
      awardPayload.badgeId,
      awardPayload.nftTokenId,
    );
  }
}
