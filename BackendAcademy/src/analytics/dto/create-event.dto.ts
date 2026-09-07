import { IsString, IsOptional, IsObject, MaxLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MaxLength(128)
  eventType: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  userId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  sessionId?: string;

  @IsObject()
  @IsOptional()
  properties?: Record<string, any>;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  ipAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  userAgent?: string;
}
