import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CenterStatus,
  SubscriptionStatus,
} from '@prisma/client';
import {
  CenterMemberRole,
  CENTER_ROLE_LEVEL,
  GlobalRole,
} from '@vidyasetu/shared';
import {
  CENTER_ID_PARAM,
  CENTER_ROLES_KEY,
} from '../decorators/auth.decorators';
import { RequestUser } from '../interfaces/request-user.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CenterAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<CenterMemberRole[]>(
      CENTER_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const centerIdParam =
      this.reflector.getAllAndOverride<string>(CENTER_ID_PARAM, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'centerId';

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{
      user: RequestUser;
      params: Record<string, string>;
      centerId?: string;
    }>();

    const centerId = request.params[centerIdParam];
    if (!centerId) {
      throw new BadRequestException(`Missing route param: ${centerIdParam}`);
    }

    const { user } = request;

    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      request.centerId = centerId;
      return true;
    }

    await this.ensureCenterActive(centerId);

    const membership = await this.prisma.centerMembership.findUnique({
      where: { userId_centerId: { userId: user.id, centerId } },
    });

    if (!membership?.isActive) {
      throw new ForbiddenException('You do not have access to this center');
    }

    if (!membership.isApproved && membership.role === 'STUDENT') {
      throw new ForbiddenException('Your registration is pending approval by an administrator or teacher.');
    }

    const userLevel = CENTER_ROLE_LEVEL[membership.role as CenterMemberRole];
    const minRequired = Math.min(...requiredRoles.map((r) => CENTER_ROLE_LEVEL[r]));

    if (userLevel < minRequired) {
      throw new ForbiddenException('Insufficient center role');
    }

    request.user = {
      ...user,
      centerMembership: {
        centerId,
        role: membership.role as CenterMemberRole,
        canManageStudents: membership.canManageStudents,
        canManageContent: membership.canManageContent,
        canManageTests: membership.canManageTests,
        canViewReports: membership.canViewReports,
      },
    };
    request.centerId = centerId;

    return true;
  }

  private async ensureCenterActive(centerId: string) {
    const center = await this.prisma.center.findUnique({ where: { id: centerId } });
    if (!center) throw new ForbiddenException('Center not found');
    if (center.status !== CenterStatus.APPROVED) {
      throw new ForbiddenException('Center is not active');
    }

    if (
      center.subscriptionExpiresAt &&
      center.subscriptionExpiresAt < new Date()
    ) {
      if (center.subscriptionStatus !== SubscriptionStatus.EXPIRED) {
        await this.prisma.center.update({
          where: { id: centerId },
          data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
        });
      }
      throw new ForbiddenException('Center subscription has expired');
    }
  }
}
