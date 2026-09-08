import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Stellar public keys are 56-char base32 (no 0/O/I/l), G-prefixed. */
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;

/** Anchor domains are bare hostnames — no scheme, path, query or fragment. */
const ANCHOR_DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i;

export class InitiateFiatRampDto {
  @ApiProperty({
    description: 'Asset code to deposit/withdraw, e.g. USDC or XLM',
    example: 'USDC',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(12)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'assetCode must be an uppercase alphanumeric asset code',
  })
  assetCode: string;

  @ApiProperty({
    description: 'Amount of the asset to deposit/withdraw',
    example: 100.5,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Stellar account receiving/sending the funds',
    example: 'GBXGQ55JMQ4L2B6E7S8Y9Z0A1B2C3D4E5F6G7H8I7YWR',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(STELLAR_PUBLIC_KEY_RE, {
    message: 'userAccount must be a valid Stellar public key',
  })
  userAccount: string;

  @ApiProperty({
    description: 'Anchor domain that hosts the SEP-24 interactive flow',
    example: 'anchor.stellar.org',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(ANCHOR_DOMAIN_RE, {
    message:
      'anchorDomain must be a bare hostname (no scheme, path, query or fragment)',
  })
  anchorDomain: string;
}