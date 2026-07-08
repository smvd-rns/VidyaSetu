export enum GlobalRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  USER = 'USER',
}

export enum CenterMemberRole {
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  STAFF = 'STAFF',
  STUDENT = 'STUDENT',
}

export enum CenterStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export enum ApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/** Role hierarchy — higher number = more privilege within a center */
export const CENTER_ROLE_LEVEL: Record<CenterMemberRole, number> = {
  [CenterMemberRole.STUDENT]: 1,
  [CenterMemberRole.STAFF]: 2,
  [CenterMemberRole.TEACHER]: 3,
  [CenterMemberRole.ADMIN]: 4,
};

export interface JwtPayload {
  sub: string;
  email: string;
  globalRole: GlobalRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
}

export interface CenterContext {
  centerId: string;
  role: CenterMemberRole;
  canManageStudents: boolean;
  canManageContent: boolean;
  canManageTests: boolean;
  canViewReports: boolean;
}
