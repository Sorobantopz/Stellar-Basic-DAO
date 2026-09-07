import { IsString, IsNumber, IsOptional, IsArray, IsEnum, MaxLength, Min } from 'class-validator';
import { GradingResultStatus } from '../interfaces/grading-result-status.enum';
import { RubricEntry } from '../interfaces/grading-result.interface';

export class SaveGradingResultDto {
  @IsString()
  @MaxLength(128)
  graderId: string;

  @IsEnum(GradingResultStatus)
  status: GradingResultStatus;

  @IsNumber()
  @Min(0)
  score: number;

  @IsNumber()
  @Min(0)
  maxScore: number;

  @IsString()
  @MaxLength(16384)
  feedback: string;

  @IsOptional()
  @IsString()
  @MaxLength(16384)
  privateNotes?: string;

  @IsOptional()
  @IsArray()
  rubric?: RubricEntry[];
}
