import { GlobalRole, CenterMemberRole } from '@vidyasetu/shared';

export interface RequestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  globalRole: GlobalRole;
  centerMembership?: {
    centerId: string;
    role: CenterMemberRole;
    canManageStudents: boolean;
    canManageContent: boolean;
    canManageTests: boolean;
    canViewReports: boolean;
  };
}
