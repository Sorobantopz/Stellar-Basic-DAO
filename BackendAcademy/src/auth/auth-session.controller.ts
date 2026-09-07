import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthSessionService } from './auth-session.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthTokensResponse, Session } from './interfaces/session.interface';
import { UserRole } from './enums/user-role.enum';

/**
 * AuthSessionController — Issue #220
 *
 * Exposes session-management endpoints under /auth/session:
 *
 *  POST   /auth/session/login         — issue access + refresh token pair
 *  POST   /auth/session/refresh       — rotate refresh token, return new pair
 *  POST   /auth/session/logout        — revoke single session
 *  POST   /auth/session/logout-all    — revoke all sessions for a user
 *  GET    /auth/session/:userId       — list active sessions (no refresh token)
 */
@Controller('auth/session')
export class AuthSessionController {
  constructor(private readonly authSessionService: AuthSessionService) {}

  /**
   * Login — creates a new session for the user.
   *
   * In a production setup you would validate userId/password against the
   * user store here. For this implementation we trust the caller and issue
   * tokens directly so the session layer can be integrated without coupling
   * to a specific auth strategy.
   */
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async login(@Body() dto: LoginDto): Promise<AuthTokensResponse> {
    return this.authSessionService.createSession(
      dto.userId,
      dto.role as UserRole,
    );
  }

  /**
   * Refresh — rotates the refresh token and returns a new token pair.
   * The old refresh token is revoked after a successful rotation.
   */
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponse> {
    return this.authSessionService.refreshTokens(dto.refreshToken);
  }

  /**
   * Logout — revokes a single session identified by sessionId.
   * The sessionId is embedded in the refresh token payload but can also
   * be supplied directly by the client.
   *
   * Uses @Body instead of @Query to avoid leaking session IDs in server logs.
   */
  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body('sessionId') sessionId: string): void {
    this.authSessionService.revokeSession(sessionId);
  }

  /**
   * Logout-all — revokes all active sessions for the given user.
   *
   * Uses @Body instead of @Query to avoid leaking user IDs in server logs.
   */
  @Post('logout-all')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  logoutAll(@Body('userId') userId: string): void {
    this.authSessionService.revokeAllUserSessions(userId);
  }

  /**
   * Active sessions — returns a list of active (non-revoked, non-expired)
   * sessions for a user. Refresh tokens are omitted from the response.
   */
  @Get(':userId')
  @HttpCode(HttpStatus.OK)
  getActiveSessions(
    @Param('userId') userId: string,
  ): Omit<Session, 'refreshToken'>[] {
    return this.authSessionService.getActiveSessions(userId);
  }
}
