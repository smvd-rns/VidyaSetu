import { SetMetadata } from '@nestjs/common';
import { GlobalRole, CenterMemberRole } from '@vidyasetu/shared';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const GLOBAL_ROLES_KEY = 'globalRoles';
export const GlobalRoles = (...roles: GlobalRole[]) => SetMetadata(GLOBAL_ROLES_KEY, roles);

export const CENTER_ROLES_KEY = 'centerRoles';
export const CenterRoles = (...roles: CenterMemberRole[]) => SetMetadata(CENTER_ROLES_KEY, roles);

export const CENTER_ID_PARAM = 'centerIdParam';
export const CenterIdParam = (param = 'centerId') => SetMetadata(CENTER_ID_PARAM, param);
