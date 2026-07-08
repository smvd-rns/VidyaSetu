import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@vidyasetu/shared';
import { GLOBAL_ROLES_KEY } from '../decorators/auth.decorators';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class GlobalRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<GlobalRole[]>(GLOBAL_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest<{ user: RequestUser }>();
    if (!requiredRoles.includes(user.globalRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
