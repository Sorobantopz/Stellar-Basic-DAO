import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body used by an admin to verify a tutor profile.
 * Records who performed the verification and an optional note.
 */
export class VerifyTutorDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  adminId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
