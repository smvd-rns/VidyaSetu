import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ApplicationStatus,
  CenterMemberRole,
  CenterStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleDriveService } from './google-drive.service';
import { RedisService } from './redis.service';
import {
  ApplyCenterDto,
  ReviewApplicationDto,
  UpdateSubscriptionDto,
  InviteMemberDto,
  CreateBatchDto,
  AssignBatchMemberDto,
  CreateCourseDto,
  CreateSubjectDto,
  CreateChapterDto,
  CreateVideoDto,
  CreateNoteDto,
  CreateYoutubeChannelDto,
  CreateTestDto,
  CreateQuestionDto,
  SubmitTestDto,
  UpdateProgressDto,
} from './dto/centers.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class CentersService {
  private syncProgress = new Map<string, any>();

  constructor(
    private prisma: PrismaService,
    private googleDrive: GoogleDriveService,
    private redis: RedisService
  ) {}

  private slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  async apply(userId: string, dto: ApplyCenterDto) {
    const baseSlug = this.slugify(dto.name);
    let slug = baseSlug;
    let attempt = 0;

    while (await this.prisma.center.findUnique({ where: { slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const existingPending = await this.prisma.centerApplication.findFirst({
      where: {
        applicantUserId: userId,
        status: ApplicationStatus.PENDING,
      },
    });

    if (existingPending) {
      throw new ConflictException('You already have a pending center application');
    }

    const trialDays = 14;
    const subscriptionExpiresAt = new Date(Date.now() + trialDays * 86400000);

    return this.prisma.$transaction(async (tx) => {
      const center = await tx.center.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          phone: dto.phone,
          email: dto.email,
          status: CenterStatus.PENDING,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          subscriptionExpiresAt,
        },
      });

      const application = await tx.centerApplication.create({
        data: {
          centerId: center.id,
          applicantUserId: userId,
          message: dto.message,
        },
      });

      return { center, application };
    });
  }

  async listApplications(status?: ApplicationStatus) {
    return this.prisma.centerApplication.findMany({
      where: status ? { status } : undefined,
      include: {
        center: true,
        applicant: {
          select: { id: true, email: true, firstName: true, lastName: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewApplication(
    applicationId: string,
    reviewerId: string,
    dto: ReviewApplicationDto,
  ) {
    const application = await this.prisma.centerApplication.findUnique({
      where: { id: applicationId },
      include: { center: true },
    });

    if (!application) throw new NotFoundException('Application not found');
    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Application already reviewed');
    }

    if (dto.status === ApplicationStatus.REJECTED) {
      return this.prisma.$transaction(async (tx) => {
        await tx.centerApplication.update({
          where: { id: applicationId },
          data: {
            status: ApplicationStatus.REJECTED,
            reviewedAt: new Date(),
            reviewedById: reviewerId,
            rejectionReason: dto.rejectionReason,
          },
        });
        await tx.center.update({
          where: { id: application.centerId },
          data: { status: CenterStatus.REJECTED },
        });
        return { status: ApplicationStatus.REJECTED };
      });
    }

    if (dto.status !== ApplicationStatus.APPROVED) {
      throw new BadRequestException('Invalid review status');
    }

    const trialDays = dto.trialDays ?? 14;
    const subscriptionExpiresAt = new Date(Date.now() + trialDays * 86400000);

    return this.prisma.$transaction(async (tx) => {
      await tx.centerApplication.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedById: reviewerId,
        },
      });

      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const generatedJoinCode = `VS-${randomPart}`;

      const center = await tx.center.update({
        where: { id: application.centerId },
        data: {
          status: CenterStatus.APPROVED,
          approvedAt: new Date(),
          approvedById: reviewerId,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          subscriptionExpiresAt,
          joinCode: generatedJoinCode,
        },
      });

      await tx.centerMembership.upsert({
        where: {
          userId_centerId: {
            userId: application.applicantUserId,
            centerId: center.id,
          },
        },
        create: {
          userId: application.applicantUserId,
          centerId: center.id,
          role: CenterMemberRole.ADMIN,
        },
        update: {
          role: CenterMemberRole.ADMIN,
          isActive: true,
        },
      });

      return { status: ApplicationStatus.APPROVED, center };
    });
  }

  async listCenters() {
    return this.prisma.center.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { memberships: true } },
      },
    });
  }

  async listAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        centerMemberships: {
          include: {
            center: {
              select: { id: true, name: true }
            },
            batchMemberships: {
              include: {
                batch: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      }
    });
  }

  async updateMembershipRole(membershipId: string, role: CenterMemberRole) {
    const membership = await this.prisma.centerMembership.findUnique({ where: { id: membershipId } });
    if (!membership) throw new NotFoundException('Membership record not found');
    return this.prisma.centerMembership.update({
      where: { id: membershipId },
      data: { role },
    });
  }

  async updateCenterMemberRole(centerId: string, membershipId: string, role: CenterMemberRole) {
    const membership = await this.prisma.centerMembership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.centerId !== centerId) {
      throw new NotFoundException('Membership record not found in this center');
    }
    return this.prisma.centerMembership.update({
      where: { id: membershipId },
      data: { role },
    });
  }

  async listAllYoutubeChannels() {
    return this.prisma.youtubeChannel.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        center: {
          select: { name: true }
        },
        batches: {
          include: {
            batch: {
              select: { name: true }
            }
          }
        }
      }
    });
  }

  async getCenter(centerId: string) {
    const center = await this.prisma.center.findUnique({
      where: { id: centerId },
      include: {
        application: true,
        _count: { select: { memberships: true, courses: true, batches: true } },
      },
    });
    if (!center) throw new NotFoundException('Center not found');
    return center;
  }

  async updateSubscription(centerId: string, dto: UpdateSubscriptionDto) {
    const center = await this.prisma.center.findUnique({ where: { id: centerId } });
    if (!center) throw new NotFoundException('Center not found');

    let subscriptionExpiresAt = center.subscriptionExpiresAt;

    if (dto.extendDays) {
      const base = subscriptionExpiresAt && subscriptionExpiresAt > new Date()
        ? subscriptionExpiresAt
        : new Date();
      subscriptionExpiresAt = new Date(base.getTime() + dto.extendDays * 86400000);
    } else if (dto.subscriptionExpiresAt) {
      subscriptionExpiresAt = new Date(dto.subscriptionExpiresAt);
    }

    const subscriptionStatus =
      subscriptionExpiresAt && subscriptionExpiresAt > new Date()
        ? SubscriptionStatus.ACTIVE
        : SubscriptionStatus.EXPIRED;

    return this.prisma.center.update({
      where: { id: centerId },
      data: { subscriptionExpiresAt, subscriptionStatus },
    });
  }

  async suspendCenter(centerId: string) {
    return this.prisma.center.update({
      where: { id: centerId },
      data: { status: CenterStatus.SUSPENDED },
    });
  }

  async activateCenter(centerId: string) {
    return this.prisma.center.update({
      where: { id: centerId },
      data: { status: CenterStatus.APPROVED },
    });
  }

  async ensureCenterActive(centerId: string) {
    const center = await this.prisma.center.findUnique({ where: { id: centerId } });
    if (!center) throw new NotFoundException('Center not found');
    if (center.status !== CenterStatus.APPROVED) {
      throw new ForbiddenException('Center is not active');
    }
    if (center.subscriptionExpiresAt && center.subscriptionExpiresAt < new Date()) {
      if (center.subscriptionStatus !== SubscriptionStatus.EXPIRED) {
        await this.prisma.center.update({
          where: { id: centerId },
          data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
        });
      }
      throw new ForbiddenException('Center subscription has expired');
    }
    return center;
  }

  async updateJoinCode(centerId: string, code: string) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const randomCode = `VS-${randomPart}`;
      return this.prisma.center.update({
        where: { id: centerId },
        data: { joinCode: randomCode },
      });
    }

    const exists = await this.prisma.center.findFirst({
      where: { joinCode: cleanCode, NOT: { id: centerId } },
    });
    if (exists) {
      throw new ForbiddenException('This join code is already in use by another center');
    }

    return this.prisma.center.update({
      where: { id: centerId },
      data: { joinCode: cleanCode },
    });
  }

  async getCenterByCode(code: string) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) throw new ForbiddenException('Code is required');

    const center = await this.prisma.center.findUnique({
      where: { joinCode: cleanCode },
      select: {
        id: true,
        name: true,
        batches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!center) {
      throw new NotFoundException('Center not found with the provided code');
    }

    return center;
  }

  async joinByCode(userId: string, code: string, batchId?: string) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) throw new ForbiddenException('Code is required');

    const center = await this.prisma.center.findUnique({
      where: { joinCode: cleanCode },
    });
    if (!center) {
      throw new NotFoundException('Center not found with the provided code');
    }

    await this.ensureCenterActive(center.id);

    let membership = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId, centerId: center.id } },
    });

    if (!membership) {
      membership = await this.prisma.centerMembership.create({
        data: {
          userId,
          centerId: center.id,
          role: CenterMemberRole.STUDENT,
          isApproved: false, // <-- Requires admin or teacher approval!
          canManageStudents: false,
          canManageContent: false,
          canManageTests: false,
          canViewReports: true,
        },
      });
    } else {
      membership = await this.prisma.centerMembership.update({
        where: { id: membership.id },
        data: { isActive: true, isApproved: false },
      });
    }

    // Link to the selected batch/standard if provided
    if (batchId) {
      const batch = await this.prisma.batch.findFirst({
        where: { id: batchId, centerId: center.id },
      });
      if (batch) {
        await this.prisma.batchMembership.upsert({
          where: {
            batchId_membershipId: {
              batchId: batch.id,
              membershipId: membership.id,
            },
          },
          create: {
            batchId: batch.id,
            membershipId: membership.id,
          },
          update: {},
        });
      }
    }

    return {
      message: 'Successfully joined center!',
      center,
      membership,
    };
  }

  async getMyCenters(userId: string) {
    return this.prisma.centerMembership.findMany({
      where: { userId, isActive: true },
      include: {
        center: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            subscriptionStatus: true,
            subscriptionExpiresAt: true,
          },
        },
      },
    });
  }

  async listMembers(centerId: string) {
    await this.ensureCenterActive(centerId);
    return this.prisma.centerMembership.findMany({
      where: { centerId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        batchMemberships: {
          include: {
            batch: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async inviteMember(centerId: string, dto: InviteMemberDto) {
    await this.ensureCenterActive(centerId);

    const role = dto.role as CenterMemberRole;
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    let tempPassword: string | undefined;

    if (!user) {
      tempPassword = crypto.randomBytes(6).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          firstName: dto.email.split('@')[0],
          lastName: '',
        },
      });
    }

    const membership = await this.prisma.centerMembership.upsert({
      where: { userId_centerId: { userId: user.id, centerId } },
      create: {
        userId: user.id,
        centerId,
        role,
        canManageStudents: dto.canManageStudents ?? role !== CenterMemberRole.STUDENT,
        canManageContent:
          dto.canManageContent ??
          ([CenterMemberRole.ADMIN, CenterMemberRole.TEACHER] as CenterMemberRole[]).includes(role),
        canManageTests:
          dto.canManageTests ??
          ([CenterMemberRole.ADMIN, CenterMemberRole.TEACHER] as CenterMemberRole[]).includes(role),
        canViewReports: dto.canViewReports ?? true,
      },
      update: {
        role,
        isActive: true,
        canManageStudents: dto.canManageStudents,
        canManageContent: dto.canManageContent,
        canManageTests: dto.canManageTests,
        canViewReports: dto.canViewReports,
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return { membership, ...(tempPassword ? { tempPassword } : {}) };
  }

  async removeMember(centerId: string, membershipId: string) {
    const membership = await this.prisma.centerMembership.findFirst({
      where: { id: membershipId, centerId },
    });
    if (!membership) throw new NotFoundException('Member not found');

    await this.prisma.centerMembership.update({
      where: { id: membershipId },
      data: { isActive: false },
    });

    return { success: true };
  }

  // ─── Batches ──────────────────────────────────────────────────────────────
  async listBatches(centerId: string) {
    await this.ensureCenterActive(centerId);
    return this.prisma.batch.findMany({
      where: { centerId },
      include: {
        memberships: {
          include: {
            membership: {
              include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        courseAssignments: {
          include: { course: true },
        },
      },
    });
  }

  async createBatch(centerId: string, dto: CreateBatchDto) {
    await this.ensureCenterActive(centerId);
    
    const existing = await this.prisma.batch.findFirst({
      where: { centerId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A classroom or group with this name already exists in this center.');
    }

    return this.prisma.batch.create({
      data: {
        centerId,
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async deleteBatch(centerId: string, batchId: string) {
    await this.ensureCenterActive(centerId);
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, centerId } });
    if (!batch) throw new NotFoundException('Batch not found');
    await this.prisma.batch.delete({ where: { id: batchId } });
    return { success: true };
  }

  async updateBatch(centerId: string, batchId: string, dto: { name: string; description?: string }) {
    await this.ensureCenterActive(centerId);
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, centerId } });
    if (!batch) throw new NotFoundException('Batch not found');

    if (dto.name && dto.name !== batch.name) {
      const existing = await this.prisma.batch.findFirst({
        where: { centerId, name: dto.name },
      });
      if (existing) {
        throw new ConflictException('A classroom or group with this name already exists in this center.');
      }
    }

    return this.prisma.batch.update({
      where: { id: batchId },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async assignBatchMember(centerId: string, batchId: string, dto: AssignBatchMemberDto) {
    await this.ensureCenterActive(centerId);
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, centerId } });
    if (!batch) throw new NotFoundException('Batch not found');

    const membership = await this.prisma.centerMembership.findFirst({
      where: { id: dto.membershipId, centerId },
    });
    if (!membership) throw new NotFoundException('Member not found in center');

    return this.prisma.batchMembership.upsert({
      where: { batchId_membershipId: { batchId, membershipId: dto.membershipId } },
      create: { batchId, membershipId: dto.membershipId },
      update: {},
    });
  }

  async removeBatchMember(centerId: string, batchId: string, membershipId: string) {
    await this.ensureCenterActive(centerId);
    const batch = await this.prisma.batch.findFirst({ where: { id: batchId, centerId } });
    if (!batch) throw new NotFoundException('Batch not found');

    const bm = await this.prisma.batchMembership.findFirst({
      where: { batchId, membershipId },
    });
    if (!bm) throw new NotFoundException('Batch membership not found');

    await this.prisma.batchMembership.delete({ where: { id: bm.id } });
    return { success: true };
  }

  // ─── Courses ─────────────────────────────────────────────────────────────
  async listCourses(centerId: string) {
    await this.ensureCenterActive(centerId);
    return this.prisma.course.findMany({
      where: { centerId },
      include: {
        subjects: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapters: {
              orderBy: { sortOrder: 'asc' },
              include: {
                videos: { orderBy: { sortOrder: 'asc' } },
                notes: true,
              },
            },
          },
        },
        batchAssignments: {
          include: { batch: true },
        },
      },
    });
  }

  async createCourse(centerId: string, dto: CreateCourseDto) {
    await this.ensureCenterActive(centerId);
    return this.prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          centerId,
          title: dto.title,
          description: dto.description,
          thumbnail: dto.thumbnail,
          isPublished: true,
        },
      });

      if (dto.batchId) {
        await tx.batchCourse.create({
          data: {
            batchId: dto.batchId,
            courseId: course.id,
          },
        });
      }

      return course;
    });
  }

  async updateCourse(centerId: string, courseId: string, dto: Partial<CreateCourseDto>) {
    await this.ensureCenterActive(centerId);
    const course = await this.prisma.course.findFirst({ where: { id: courseId, centerId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        title: dto.title,
        description: dto.description,
        thumbnail: dto.thumbnail,
      },
    });
  }

  async createSubject(centerId: string, courseId: string, dto: CreateSubjectDto) {
    await this.ensureCenterActive(centerId);
    const course = await this.prisma.course.findFirst({ where: { id: courseId, centerId } });
    if (!course) throw new NotFoundException('Course not found');

    return this.prisma.subject.create({
      data: {
        courseId,
        title: dto.title,
      },
    });
  }

  async createChapter(centerId: string, subjectId: string, dto: CreateChapterDto) {
    await this.ensureCenterActive(centerId);
    const subject = await this.prisma.subject.findFirst({
      where: { id: subjectId, course: { centerId } },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    return this.prisma.chapter.create({
      data: {
        subjectId,
        title: dto.title,
      },
    });
  }

  async createVideo(centerId: string, chapterId: string, dto: CreateVideoDto) {
    await this.ensureCenterActive(centerId);
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, subject: { course: { centerId } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    return this.prisma.video.create({
      data: {
        chapterId,
        youtubeId: dto.youtubeId,
        title: dto.title,
        description: dto.description,
        duration: dto.duration,
      },
    });
  }

  async createNote(centerId: string, chapterId: string, dto: CreateNoteDto) {
    await this.ensureCenterActive(centerId);
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, subject: { course: { centerId } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    return this.prisma.note.create({
      data: {
        centerId,
        chapterId,
        title: dto.title,
        description: dto.description,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        fileSize: dto.fileSize,
        contentType: dto.contentType,
        isPublished: true,
      },
    });
  }

  async listNotes(centerId: string) {
    await this.ensureCenterActive(centerId);
    return this.prisma.note.findMany({
      where: { centerId },
      orderBy: { createdAt: 'desc' },
    });
  }
  async listVideos(centerId: string, userId?: string) {
    await this.ensureCenterActive(centerId);

    let isStudent = false;
    let batchIds: string[] = [];
    let membershipId: string | undefined;

    if (userId) {
      const membership = await this.prisma.centerMembership.findUnique({
        where: { userId_centerId: { userId, centerId } },
        include: { batchMemberships: true },
      });
      if (membership) {
        membershipId = membership.id;
        isStudent = membership.role === 'STUDENT';
        batchIds = membership.batchMemberships.map((bm) => bm.batchId);
      }
    }

    const cacheKey = isStudent
      ? `youtube:videos:${centerId}:student:${userId}`
      : `youtube:videos:${centerId}:staff`;

    const cached = await this.redis.get<any[]>(cacheKey);
    let videos: any[];

    if (cached) {
      videos = cached;
    } else {
      const dbVideos = await this.prisma.video.findMany({
        where: {
          OR: [
            // Chapter Videos
            {
              chapter: {
                subject: {
                  course: {
                    centerId,
                    ...(isStudent ? {
                      batchAssignments: {
                        some: {
                          batchId: { in: batchIds }
                        }
                      }
                    } : {})
                  }
                }
              }
            },
            // YouTube Channel Videos
            {
              playlist: {
                channel: {
                  centerId,
                  ...(isStudent ? {
                    batches: {
                      some: {
                        batchId: { in: batchIds }
                      }
                    }
                  } : {})
                }
              }
            }
          ]
        },
        include: {
          _count: {
            select: { likes: true }
          },
          playlist: {
            include: {
              channel: true
            }
          }
        },
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' }
        ],
      });

      videos = dbVideos.map((v) => {
        const { _count, ...rest } = v as any;
        return {
          ...rest,
          likesCount: _count?.likes || 0,
        };
      });

      await this.redis.set(cacheKey, videos, 600); // 10 minutes cache
    }

    let likedVideoIds = new Set<string>();
    if (membershipId) {
      const userLikes = await this.prisma.videoLike.findMany({
        where: { membershipId },
        select: { videoId: true }
      });
      likedVideoIds = new Set(userLikes.map(l => l.videoId));
    }

    return videos.map(v => ({
      ...v,
      liked: likedVideoIds.has(v.id)
    }));
  }

  async listShorts(centerId: string, userId: string, limit = 12) {
    await this.ensureCenterActive(centerId);

    const membership = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId, centerId } },
      include: { batchMemberships: true },
    });

    if (!membership) throw new NotFoundException('Membership not found.');

    const isStudent = membership.role === 'STUDENT';
    const batchIds = membership.batchMemberships.map((bm) => bm.batchId);

    const dbVideos = await this.prisma.video.findMany({
      where: {
        isShort: true,
        OR: [
          // Chapter Videos
          {
            chapter: {
              subject: {
                course: {
                  centerId,
                  ...(isStudent ? {
                    batchAssignments: {
                      some: {
                        batchId: { in: batchIds }
                      }
                    }
                  } : {})
                }
              }
            }
          },
          // YouTube Channel Videos
          {
            playlist: {
              channel: {
                centerId,
                ...(isStudent ? {
                  batches: {
                    some: {
                      batchId: { in: batchIds }
                    }
                  }
                } : {})
              }
            }
          }
        ]
      },
      include: {
        _count: {
          select: { likes: true }
        },
        playlist: {
          include: {
            channel: true,
          },
        },
      },
    });

    const videos = dbVideos.map((v) => {
      const { _count, ...rest } = v as any;
      return {
        ...rest,
        likesCount: _count?.likes || 0,
      };
    });

    // Balanced randomized selection (like Safe-YT)
    const channelMap = new Map<string, any[]>();
    for (const v of videos) {
      const channelId = v.playlist?.channelId || 'teacher-uploaded';
      if (!channelMap.has(channelId)) {
        channelMap.set(channelId, []);
      }
      channelMap.get(channelId)!.push(v);
    }

    // Shuffle within each channel
    for (const [key, list] of channelMap.entries()) {
      channelMap.set(key, list.sort(() => Math.random() - 0.5));
    }

    // Interleave
    const interleaved: any[] = [];
    const channelsList = Array.from(channelMap.keys()).sort(() => Math.random() - 0.5);
    const maxLen = Math.max(0, ...Array.from(channelMap.values()).map(r => r.length));

    for (let i = 0; i < maxLen && interleaved.length < limit; i++) {
      for (const channelId of channelsList) {
        const list = channelMap.get(channelId)!;
        if (i < list.length && interleaved.length < limit) {
          interleaved.push(list[i]);
        }
      }
    }

    // Final shuffle
    const finalShorts = interleaved.sort(() => Math.random() - 0.5);

    const userLikes = await this.prisma.videoLike.findMany({
      where: { membershipId: membership.id },
      select: { videoId: true }
    });
    const likedVideoIds = new Set(userLikes.map(l => l.videoId));

    return finalShorts.map(v => ({
      ...v,
      liked: likedVideoIds.has(v.id)
    }));
  }

  async toggleLikeVideo(centerId: string, videoId: string, userId: string) {
    await this.ensureCenterActive(centerId);
    
    const membership = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId, centerId } }
    });
    if (!membership) throw new NotFoundException('Membership not found.');
    const membershipId = membership.id;

    const existing = await this.prisma.videoLike.findUnique({
      where: {
        membershipId_videoId: {
          membershipId,
          videoId,
        }
      }
    });

    if (existing) {
      await this.prisma.videoLike.delete({
        where: { id: existing.id }
      });
    } else {
      await this.prisma.videoLike.create({
        data: {
          membershipId,
          videoId,
        }
      });
    }

    await this.redis.del(`youtube:videos:${centerId}`);
    await this.redis.del(`youtube:videos:${centerId}:student:${userId}`);
    await this.redis.del(`youtube:videos:${centerId}:staff`);

    const count = await this.prisma.videoLike.count({
      where: { videoId }
    });

    return {
      liked: !existing,
      likesCount: count,
    };
  }

  async toggleLikePlaylist(centerId: string, playlistId: string, userId: string) {
    await this.ensureCenterActive(centerId);
    
    const membership = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId, centerId } }
    });
    if (!membership) throw new NotFoundException('Membership not found.');
    const membershipId = membership.id;

    const existing = await this.prisma.playlistLike.findUnique({
      where: {
        membershipId_playlistId: {
          membershipId,
          playlistId,
        }
      }
    });

    if (existing) {
      await this.prisma.playlistLike.delete({
        where: { id: existing.id }
      });
    } else {
      await this.prisma.playlistLike.create({
        data: {
          membershipId,
          playlistId,
        }
      });
    }

    await this.redis.del(`youtube:playlists:${centerId}`);

    return {
      liked: !existing
    };
  }

  async getLibrary(centerId: string, userId: string) {
    await this.ensureCenterActive(centerId);

    const membership = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId, centerId } },
      include: {
        videoLikes: {
          include: {
            video: {
              include: {
                playlist: {
                  include: {
                    channel: true
                  }
                }
              }
            }
          }
        },
        playlistLikes: {
          include: {
            playlist: {
              include: {
                channel: true,
                videos: {
                  take: 1
                },
                _count: {
                  select: { videos: true }
                }
              }
            }
          }
        }
      }
    });

    if (!membership) throw new NotFoundException('Membership not found.');

    const likedVideos = membership.videoLikes.map(vl => {
      return {
        ...vl.video,
        liked: true,
        likesCount: 1
      };
    });

    const savedPlaylists = membership.playlistLikes.map(pl => {
      return {
        ...pl.playlist,
        liked: true,
        videosCount: pl.playlist._count?.videos || 0
      };
    });

    return {
      videos: likedVideos,
      playlists: savedPlaylists
    };
  }
  // ─── YouTube Channels ──────────────────────────────────────────────────────
  async listYoutubeChannels(centerId: string, batchId?: string) {
    await this.ensureCenterActive(centerId);
    
    const whereClause: any = { centerId };
    if (batchId) {
      whereClause.batches = {
        some: { batchId },
      };
    }

    const channels = await this.prisma.youtubeChannel.findMany({
      where: whereClause,
      include: {
        playlists: {
          include: {
            _count: {
              select: { videos: true }
            }
          }
        },
        batches: {
          select: {
            batchId: true,
          }
        }
      }
    });

    return channels.map((c) => {
      const playlistsCount = c.playlists.length;
      const videosCount = c.playlists.reduce((sum, p) => sum + p._count.videos, 0);
      const batchIds = c.batches.map((b) => b.batchId);
      
      const { playlists, batches, ...rest } = c as any;
      return {
        ...rest,
        batchIds,
        playlistsCount,
        videosCount,
      };
    });
  }

  async listChannelPlaylists(centerId: string, channelId: string, userId?: string) {
    await this.ensureCenterActive(centerId);
    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { centerId_channelId: { centerId, channelId } },
    });
    if (!channel) throw new NotFoundException('YouTube channel not found.');

    const playlists = await this.prisma.youtubePlaylist.findMany({
      where: { channelId: channel.id },
      include: {
        _count: {
          select: { videos: true }
        }
      }
    });

    let likedPlaylistIds = new Set<string>();
    if (userId) {
      const membership = await this.prisma.centerMembership.findUnique({
        where: { userId_centerId: { userId, centerId } }
      });
      if (membership) {
        const userLikes = await this.prisma.playlistLike.findMany({
          where: { membershipId: membership.id },
          select: { playlistId: true }
        });
        likedPlaylistIds = new Set(userLikes.map(l => l.playlistId));
      }
    }

    return playlists.map(p => ({
      ...p,
      liked: likedPlaylistIds.has(p.id)
    }));
  }

  async listPlaylistVideos(centerId: string, playlistId: string, userId?: string) {
    await this.ensureCenterActive(centerId);

    const playlist = await this.prisma.youtubePlaylist.findUnique({
      where: { id: playlistId }
    });
    if (!playlist) throw new NotFoundException('Playlist not found.');

    const dbVideos = await this.prisma.video.findMany({
      where: { playlistId: playlist.id },
      include: {
        _count: {
          select: { likes: true }
        },
        playlist: {
          include: {
            channel: true
          }
        }
      },
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const videos = dbVideos.map((v) => {
      const { _count, ...rest } = v as any;
      return {
        ...rest,
        likesCount: _count?.likes || 0,
      };
    });

    let likedVideoIds = new Set<string>();
    if (userId) {
      const membership = await this.prisma.centerMembership.findUnique({
        where: { userId_centerId: { userId, centerId } }
      });
      if (membership) {
        const userLikes = await this.prisma.videoLike.findMany({
          where: { membershipId: membership.id },
          select: { videoId: true }
        });
        likedVideoIds = new Set(userLikes.map(l => l.videoId));
      }
    }

    return videos.map(v => ({
      ...v,
      liked: likedVideoIds.has(v.id)
    }));
  }

  async createYoutubeChannel(centerId: string, dto: CreateYoutubeChannelDto) {
    await this.ensureCenterActive(centerId);
    const created = await this.prisma.youtubeChannel.upsert({
      where: { centerId_channelId: { centerId, channelId: dto.channelId } },
      create: {
        centerId,
        channelId: dto.channelId,
        title: dto.title,
        description: dto.description,
        thumbnail: dto.thumbnail,
      },
      update: {
        title: dto.title,
        description: dto.description,
        thumbnail: dto.thumbnail,
      },
    });

    if (dto.batchIds !== undefined) {
      await this.prisma.batchYoutubeChannel.deleteMany({
        where: { youtubeChannelId: created.id },
      });

      if (dto.batchIds.length > 0) {
        await this.prisma.batchYoutubeChannel.createMany({
          data: dto.batchIds.map((batchId) => ({
            batchId,
            youtubeChannelId: created.id,
          })),
        });
      }
    }


    await this.redis.del(`youtube:videos:${centerId}`);
    return created;
  }

  async deleteYoutubeChannel(centerId: string, channelId: string) {
    await this.ensureCenterActive(centerId);
    
    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { centerId_channelId: { centerId, channelId } },
      include: { playlists: true }
    });

    if (channel) {
      const playlistIds = channel.playlists.map((p) => p.id);
      
      // Delete child associations first
      await this.prisma.videoLike.deleteMany({
        where: { video: { playlistId: { in: playlistIds } } }
      });

      await this.prisma.studentProgress.deleteMany({
        where: { video: { playlistId: { in: playlistIds } } }
      });

      // Delete the videos
      await this.prisma.video.deleteMany({
        where: { playlistId: { in: playlistIds } }
      });
    }

    const deleted = await this.prisma.youtubeChannel.delete({
      where: { centerId_channelId: { centerId, channelId } },
    });
    await this.redis.del(`youtube:videos:${centerId}`);
    return deleted;
  }

  getSyncStatus(centerId: string, channelId: string) {
    const key = `${centerId}:${channelId}`;
    const progress = this.syncProgress.get(key);
    if (!progress) {
      return {
        channelId,
        status: 'idle',
        playlistsTotal: 0,
        playlistsProcessed: 0,
        videosTotal: 0,
        videosProcessed: 0,
        stage: 'idle',
        engine: process.env.REDIS_URL ? 'REDIS' : 'LOCAL',
      };
    }

    // Auto-cleanup terminal states after 10s (enough time for frontend to read completed status)
    if (['completed', 'failed', 'cancelled'].includes(progress.status)) {
      setTimeout(() => {
        this.syncProgress.delete(key);
      }, 10000);
    }

    return progress;
  }

  cancelSync(centerId: string, channelId: string) {
    const key = `${centerId}:${channelId}`;
    const progress = this.syncProgress.get(key);
    if (progress && progress.status === 'syncing') {
      progress.status = 'cancelled';
      progress.stage = 'cancelled';
    }
    return { cancelled: true };
  }

  // ─── Scheduled Task (Runs twice daily) ──────────────────────────────────────
  @Cron(CronExpression.EVERY_12_HOURS)
  async handleScheduledSync() {
    console.log('Starting scheduled YouTube channel sync...');
    try {
      const activeChannels = await this.prisma.youtubeChannel.findMany({
        where: { isActive: true },
        select: { centerId: true, channelId: true },
      });

      console.log(`Found ${activeChannels.length} active channels to sync.`);
      for (const channel of activeChannels) {
        try {
          await this.syncYoutubeChannelVideos(channel.centerId, channel.channelId, false);
          console.log(`Scheduled sync triggered for channel ${channel.channelId} in center ${channel.centerId}`);
        } catch (err) {
          console.error(`Failed scheduled sync for channel ${channel.channelId}:`, err);
        }
      }
    } catch (error) {
      console.error('Error in scheduled sync task:', error);
    }
  }

  async syncYoutubeChannelVideos(centerId: string, channelId: string, force = false) {
    await this.ensureCenterActive(centerId);
    
    const key = `${centerId}:${channelId}`;
    const current = this.syncProgress.get(key);
    if (current && current.status === 'syncing') {
      return { started: false, message: 'Sync already in progress.' };
    }

    const channelMeta = await this.prisma.youtubeChannel.findUnique({
      where: { centerId_channelId: { centerId, channelId } },
      select: { id: true, lastSyncedAt: true },
    });

    const sinceDate = (!force && channelMeta?.lastSyncedAt) ? channelMeta.lastSyncedAt : null;
    const syncMode = sinceDate ? 'INCREMENTAL' : 'FULL_SCAN';

    const initial = {
      channelId,
      status: 'syncing',
      playlistsTotal: 0,
      playlistsProcessed: 0,
      videosTotal: 0,
      videosProcessed: 0,
      stage: 'initiating',
      syncMode,
      sinceDate,
      engine: process.env.REDIS_URL ? 'REDIS' : 'LOCAL',
    };
    this.syncProgress.set(key, initial);

    // Run the sync process in the background
    this.runSyncInBackground(centerId, channelId, sinceDate).catch((err) => {
      console.error(`Background sync failed for channel ${channelId}:`, err);
    });

    return { started: true, syncMode };
  }

  private async runSyncInBackground(centerId: string, channelId: string, sinceDate: Date | null = null) {
    const key = `${centerId}:${channelId}`;
    const progress = this.syncProgress.get(key);
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error('YouTube API key is not configured.');
      }

      const channelRecord = await this.prisma.youtubeChannel.findUnique({
        where: { centerId_channelId: { centerId, channelId } },
        include: { playlists: true },
      });
      if (!channelRecord) {
        throw new Error('YouTube channel not found.');
      }

      // Stage 1: Resolve playlists
      // On incremental sync: reuse playlists already in DB (zero API tokens)
      // On full scan: fetch from YouTube API and upsert into DB
      progress.stage = 'fetching_playlists';
      let playlistsToSync: any[];

      if (sinceDate && channelRecord.playlists.length > 0) {
        // INCREMENTAL: use existing DB playlists, no API call needed
        playlistsToSync = channelRecord.playlists;
        progress.playlistsTotal = playlistsToSync.length;
      } else {
        // FULL SCAN: fetch uploads playlist + all channel playlists from YouTube
        const chanRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
        );
        const chanData = await chanRes.json() as any;
        if (!chanData.items || chanData.items.length === 0) {
          throw new Error('Failed to find channel details from YouTube API.');
        }
        const uploadsPlaylistId = chanData.items[0].contentDetails.relatedPlaylists.uploads;

        const playlistsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=${channelId}&maxResults=50&key=${apiKey}`
        );
        const playlistsData = await playlistsRes.json() as any;

        const uploadsPlaylistRecord = await this.prisma.youtubePlaylist.upsert({
          where: { channelId_playlistId: { channelId: channelRecord.id, playlistId: uploadsPlaylistId } },
          create: {
            channelId: channelRecord.id,
            playlistId: uploadsPlaylistId,
            title: `${channelRecord.title} Uploads`,
            description: 'Latest uploads synced automatically',
          },
          update: { title: `${channelRecord.title} Uploads` },
        });

        playlistsToSync = [uploadsPlaylistRecord];
        if (playlistsData.items?.length > 0) {
          for (const item of playlistsData.items) {
            const playlistRecord = await this.prisma.youtubePlaylist.upsert({
              where: { channelId_playlistId: { channelId: channelRecord.id, playlistId: item.id } },
              create: {
                channelId: channelRecord.id,
                playlistId: item.id,
                title: item.snippet.title,
                description: item.snippet.description || '',
                thumbnail: item.snippet.thumbnails?.default?.url || '',
              },
              update: {
                title: item.snippet.title,
                description: item.snippet.description || '',
                thumbnail: item.snippet.thumbnails?.default?.url || '',
              },
            });
            playlistsToSync.push(playlistRecord);
          }
        }
        progress.playlistsTotal = playlistsToSync.length;
      }

      // Stage 2: Fetch new videos for each playlist
      // INCREMENTAL: YouTube returns items newest-first. Stop the moment we hit a
      //              video older than sinceDate — everything after it is already synced.
      // FULL SCAN:   Collect all items across all pages.
      progress.stage = 'fetching_videos';
      const allVideoItems = [];
      for (const playlist of playlistsToSync) {
        // Check for cancellation between playlists
        if (progress.status === 'cancelled') return;
        try {
          let pageToken: string | null = null;
          let doneWithPlaylist = false;

          while (!doneWithPlaylist) {
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,status&playlistId=${playlist.playlistId}&maxResults=50&key=${apiKey}${
              pageToken ? `&pageToken=${pageToken}` : ''
            }`;
            const listRes = await fetch(url);
            const listData = await listRes.json() as any;

            if (listData.items) {
              for (const item of listData.items) {
                if (item.status?.privacyStatus === 'private') continue;

                // INCREMENTAL CUT-OFF: stop when we reach videos older than sinceDate
                if (sinceDate) {
                  const publishedAt = new Date(item.snippet.publishedAt);
                  if (publishedAt <= sinceDate) {
                    doneWithPlaylist = true; // stop paging this playlist entirely
                    break;
                  }
                }

                allVideoItems.push({
                  youtubeId: item.snippet.resourceId.videoId,
                  title: item.snippet.title,
                  description: item.snippet.description || '',
                  playlistId: playlist.id,
                  publishedAt: item.snippet.publishedAt ? new Date(item.snippet.publishedAt) : null,
                });
              }
            }

            // Continue to next page only on full scan, and only if there is one
            if (!doneWithPlaylist && listData.nextPageToken && !sinceDate) {
              pageToken = listData.nextPageToken;
            } else {
              doneWithPlaylist = true;
            }
          }

          progress.playlistsProcessed++;
        } catch (err) {
          console.error(`Failed to fetch items for playlist ${playlist.playlistId}:`, err);
        }
      }

      progress.videosTotal = allVideoItems.length;

      // Stage 3: Fetch durations
      progress.stage = 'fetching_durations';
      const uniqueVideoIds = Array.from(new Set(allVideoItems.map((v) => v.youtubeId)));
      const durationMap = new Map<string, number>();

      // Check database to see if we already have duration for these videos to save API tokens
      const existingVideos = await this.prisma.video.findMany({
        where: { youtubeId: { in: uniqueVideoIds }, duration: { not: null } },
        select: { youtubeId: true, duration: true },
      });
      for (const ev of existingVideos) {
        durationMap.set(ev.youtubeId, ev.duration!);
      }

      const videoIdsToQuery = uniqueVideoIds.filter((id) => !durationMap.has(id));

      for (let i = 0; i < videoIdsToQuery.length; i += 50) {
        // Check for cancellation between duration batches
        if (progress.status === 'cancelled') return;
        const chunk = videoIdsToQuery.slice(i, i + 50);
        const idsParam = chunk.join(',');
        try {
          const detailRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${idsParam}&key=${apiKey}`
          );
          const detailData = await detailRes.json() as any;
          if (detailData.items) {
            for (const detailItem of detailData.items) {
              const isoDuration = detailItem.contentDetails?.duration;
              const durationSec = parseISO8601Duration(isoDuration);
              durationMap.set(detailItem.id, durationSec);
            }
          }
        } catch (err) {
          console.error('Failed to fetch duration batch:', err);
        }
      }

      // Stage 4: Saving to DB
      progress.stage = 'saving_to_db';
      let savedCount = 0;

      // 1. Fetch all existing videos for the playlists being synced in a single query
      const playlistDbIds = playlistsToSync.map((p) => p.id);
      const existingVideosInPlaylists = await this.prisma.video.findMany({
        where: { playlistId: { in: playlistDbIds } },
        select: { id: true, youtubeId: true, playlistId: true },
      });

      const existingMap = new Map<string, string>();
      for (const ev of existingVideosInPlaylists) {
        existingMap.set(`${ev.youtubeId}:${ev.playlistId}`, ev.id);
      }

      // 2. Perform sequential upserts (prevents parallel connection flooding)
      for (const item of allVideoItems) {
        if (progress.status === 'cancelled') return;

        const duration = durationMap.get(item.youtubeId) || null;
        const isShort = duration !== null && duration > 0 && duration < 180;
        const existingId = existingMap.get(`${item.youtubeId}:${item.playlistId}`);

        await this.prisma.video.upsert({
          where: { id: existingId ?? 'temp-upsert-uuid' },
          create: {
            playlistId: item.playlistId,
            youtubeId: item.youtubeId,
            title: item.title,
            description: item.description?.substring(0, 500) || '',
            duration,
            isShort,
            publishedAt: item.publishedAt,
          },
          update: {
            title: item.title,
            description: item.description?.substring(0, 500) || '',
            duration,
            isShort,
            publishedAt: item.publishedAt,
          },
        });

        savedCount++;
        // Update progress every 10 videos
        if (savedCount % 10 === 0 || savedCount === allVideoItems.length) {
          progress.videosProcessed = savedCount;
        }
      }

      await this.prisma.youtubeChannel.update({
        where: { centerId_channelId: { centerId, channelId } },
        data: { lastSyncedAt: new Date() },
      });

      await this.redis.del(`youtube:videos:${centerId}`);

      progress.status = 'completed';
      progress.stage = 'done';
      progress.syncedCount = savedCount;

      this.fillMissingMetadataInBackground(centerId, channelId).catch((err) => {
        console.error('Failed to trigger background metadata repair:', err);
      });
    } catch (err) {
      console.error(err);
      progress.status = 'failed';
      progress.errorMessage = err.message || 'Unknown error occurred.';
    }
  }

  async fillMissingMetadataInBackground(centerId: string, channelId: string) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return;

    try {
      const channel = await this.prisma.youtubeChannel.findUnique({
        where: { centerId_channelId: { centerId, channelId } },
        include: { playlists: true }
      });
      if (!channel) return;

      const playlistIds = channel.playlists.map(p => p.id);
      
      const videosToRepair = await this.prisma.video.findMany({
        where: {
          playlistId: { in: playlistIds },
          publishedAt: null
        },
        select: { id: true, youtubeId: true }
      });

      if (videosToRepair.length === 0) return;

      console.log(`[Metadata Repair] Repairing ${videosToRepair.length} videos with null publishedAt for channel ${channelId}`);

      for (let i = 0; i < videosToRepair.length; i += 50) {
        const chunk = videosToRepair.slice(i, i + 50);
        const idsParam = chunk.map(v => v.youtubeId).join(',');

        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${idsParam}&key=${apiKey}`
        );
        const data = await res.json() as any;

        if (data.items) {
          for (const item of data.items) {
            const publishedAt = item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null;
            if (publishedAt) {
              await this.prisma.video.updateMany({
                where: {
                  playlistId: { in: playlistIds },
                  youtubeId: item.id,
                  publishedAt: null
                },
                data: { publishedAt }
              });
            }
          }
        }
      }
      console.log(`[Metadata Repair] Completed repairing metadata for channel ${channelId}`);
    } catch (err) {
      console.error(`[Metadata Repair] Failed to repair metadata for channel ${channelId}:`, err);
    }
  }

  // ─── Tests & MCQ Quizzes ────────────────────────────────────────────────────
  async listTests(centerId: string) {
    await this.ensureCenterActive(centerId);
    return this.prisma.test.findMany({
      where: { centerId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });
  }

  async createTest(centerId: string, dto: CreateTestDto) {
    await this.ensureCenterActive(centerId);
    return this.prisma.test.create({
      data: {
        centerId,
        title: dto.title,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        totalMarks: dto.totalMarks,
        passingMarks: dto.passingMarks,
        negativeMarking: dto.negativeMarking ?? 0,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        isPublished: true,
      },
    });
  }

  async createQuestion(centerId: string, testId: string, dto: CreateQuestionDto) {
    await this.ensureCenterActive(centerId);
    const test = await this.prisma.test.findFirst({ where: { id: testId, centerId } });
    if (!test) throw new NotFoundException('Test not found');

    return this.prisma.question.create({
      data: {
        testId,
        type: dto.type,
        text: dto.text,
        marks: dto.marks,
        options: {
          create: dto.options.map((opt) => ({
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
        },
      },
      include: { options: true },
    });
  }

  async submitTest(centerId: string, testId: string, membershipId: string, dto: SubmitTestDto) {
    await this.ensureCenterActive(centerId);
    const test = await this.prisma.test.findFirst({
      where: { id: testId, centerId },
      include: { questions: { include: { options: true } } },
    });
    if (!test) throw new NotFoundException('Test not found');

    let score = 0;
    for (const ans of dto.answers) {
      const question = test.questions.find((q) => q.id === ans.questionId);
      if (!question) continue;
      const correctOption = question.options.find((o) => o.isCorrect);
      if (correctOption && correctOption.id === ans.selectedAnswerId) {
        score += question.marks;
      } else {
        score -= test.negativeMarking * question.marks;
      }
    }

    const percentage = test.totalMarks > 0 ? (score / test.totalMarks) * 100 : 0;
    const passed = score >= test.passingMarks;

    return this.prisma.testResult.create({
      data: {
        testId,
        membershipId,
        score,
        totalMarks: test.totalMarks,
        percentage,
        passed,
        timeTakenSec: dto.timeTakenSec,
      },
    });
  }

  async getTestResults(centerId: string, testId: string) {
    await this.ensureCenterActive(centerId);
    const test = await this.prisma.test.findFirst({ where: { id: testId, centerId } });
    if (!test) throw new NotFoundException('Test not found');

    return this.prisma.testResult.findMany({
      where: { testId },
      include: {
        membership: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { score: 'desc' },
    });
  }

  // ─── Student Progress Tracking ──────────────────────────────────────────────
  async updateProgress(
    centerId: string,
    videoId: string,
    membershipId: string,
    dto: UpdateProgressDto,
  ) {
    await this.ensureCenterActive(centerId);
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, chapter: { subject: { course: { centerId } } } },
    });
    if (!video) throw new NotFoundException('Video not found in this center');

    return this.prisma.studentProgress.upsert({
      where: { membershipId_videoId: { membershipId, videoId } },
      create: {
        membershipId,
        videoId,
        completed: dto.completed,
        watchTimeSec: dto.watchTimeSec,
        completionPct: dto.completionPct,
      },
      update: {
        completed: dto.completed,
        watchTimeSec: dto.watchTimeSec,
        completionPct: dto.completionPct,
        lastViewedAt: new Date(),
      },
    });
  }

  async getProgressReport(centerId: string, batchId?: string) {
    await this.ensureCenterActive(centerId);
    return this.prisma.studentProgress.findMany({
      where: {
        membership: {
          centerId,
          role: CenterMemberRole.STUDENT,
          batchMemberships: batchId ? { some: { batchId } } : undefined,
        },
      },
      include: {
        membership: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        video: true,
      },
    });
  }

  async listPendingMembers(centerId: string, requestUserId: string) {
    const requester = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId: requestUserId, centerId } },
    });
    if (!requester) throw new ForbiddenException('Not a member of this center');

    if (requester.role === 'ADMIN' || requester.role === 'STAFF') {
      return this.prisma.centerMembership.findMany({
        where: { centerId, isApproved: false, isActive: true },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          batchMemberships: {
            include: { batch: { select: { name: true } } },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });
    }

    if (requester.role === 'TEACHER') {
      const teacherBatches = await this.prisma.batchMembership.findMany({
        where: { membershipId: requester.id },
        select: { batchId: true },
      });
      const batchIds = teacherBatches.map((tb) => tb.batchId);

      return this.prisma.centerMembership.findMany({
        where: {
          centerId,
          isApproved: false,
          isActive: true,
          batchMemberships: {
            some: { batchId: { in: batchIds } },
          },
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          batchMemberships: {
            include: { batch: { select: { name: true } } },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });
    }

    throw new ForbiddenException('Students cannot view pending registration logs');
  }

  async approveMember(centerId: string, membershipId: string, requestUserId: string) {
    const requester = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId: requestUserId, centerId } },
    });
    if (!requester) throw new ForbiddenException('Not a member of this center');

    const target = await this.prisma.centerMembership.findUnique({
      where: { id: membershipId },
      include: { batchMemberships: true },
    });
    if (!target || target.centerId !== centerId) {
      throw new NotFoundException('Pending student not found');
    }

    if (requester.role === 'ADMIN' || requester.role === 'STAFF') {
      return this.prisma.centerMembership.update({
        where: { id: membershipId },
        data: { isApproved: true },
      });
    }

    if (requester.role === 'TEACHER') {
      const teacherBatches = await this.prisma.batchMembership.findMany({
        where: { membershipId: requester.id },
        select: { batchId: true },
      });
      const batchIds = teacherBatches.map((tb) => tb.batchId);
      
      const hasCommonBatch = target.batchMemberships.some((bm) => batchIds.includes(bm.batchId));
      if (!hasCommonBatch) {
        throw new ForbiddenException('You are not assigned to this classroom/group');
      }

      return this.prisma.centerMembership.update({
        where: { id: membershipId },
        data: { isApproved: true },
      });
    }

    throw new ForbiddenException('Only admins or teachers can approve registrations');
  }

  async uploadMedia(centerId: string, file: any) {
    // 1. Upload to Google Drive and get fileId
    const fileId = await this.googleDrive.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    // 2. Generate the direct image viewing url
    const fileUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

    // 3. Save to database
    return this.prisma.centerMedia.create({
      data: {
        centerId,
        fileName: file.originalname,
        fileId,
        fileUrl,
      },
    });
  }

  async listMedia(centerId: string) {
    return this.prisma.centerMedia.findMany({
      where: { centerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

function parseISO8601Duration(durationStr: string): number {
  if (!durationStr) return 0;
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const matches = durationStr.match(regex);
  if (!matches) return 0;

  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  const seconds = parseInt(matches[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}
