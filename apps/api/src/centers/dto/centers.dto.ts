import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEmail,
  IsInt,
  Min,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class ApplyCenterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

export class ReviewApplicationDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  trialDays?: number;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  extendDays?: number;

  @IsOptional()
  subscriptionExpiresAt?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsString()
  role!: 'ADMIN' | 'TEACHER' | 'STAFF' | 'STUDENT';

  @IsOptional()
  canManageStudents?: boolean;

  @IsOptional()
  canManageContent?: boolean;

  @IsOptional()
  canManageTests?: boolean;

  @IsOptional()
  canViewReports?: boolean;
}

export class CreateBatchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class AssignBatchMemberDto {
  @IsString()
  membershipId!: string;
}

export class CreateCourseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}

export class CreateSubjectDto {
  @IsString()
  @MinLength(2)
  title!: string;
}

export class CreateChapterDto {
  @IsString()
  @MinLength(2)
  title!: string;
}

export class CreateVideoDto {
  @IsString()
  youtubeId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  duration?: number;
}

export class CreateNoteDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  fileUrl!: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsInt()
  fileSize?: number;

  @IsString()
  contentType!: 'PDF' | 'DOCX' | 'IMAGE' | 'OTHER';
}

export class CreateYoutubeChannelDto {
  @IsString()
  channelId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  batchIds?: string[];
}

export class CreateTestDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @IsInt()
  @Min(1)
  totalMarks!: number;

  @IsInt()
  @Min(1)
  passingMarks!: number;

  @IsOptional()
  negativeMarking?: number;

  @IsOptional()
  shuffleQuestions?: boolean;
}

export class CreateAnswerOptionDto {
  @IsString()
  text!: string;

  isCorrect!: boolean;
}

export class CreateQuestionDto {
  @IsString()
  type!: 'MCQ' | 'TRUE_FALSE';

  @IsString()
  text!: string;

  @IsInt()
  marks!: number;

  options!: CreateAnswerOptionDto[];
}

export class SubmitTestAnswerDto {
  @IsString()
  questionId!: string;

  @IsString()
  selectedAnswerId!: string;
}

export class SubmitTestDto {
  answers!: SubmitTestAnswerDto[];

  @IsOptional()
  @IsInt()
  timeTakenSec?: number;
}

export class UpdateProgressDto {
  completed!: boolean;

  @IsInt()
  watchTimeSec!: number;

  completionPct!: number;
}
