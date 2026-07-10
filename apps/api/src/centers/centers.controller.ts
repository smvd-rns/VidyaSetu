import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApplicationStatus } from '@prisma/client';
import { GlobalRole, CenterMemberRole } from '@vidyasetu/shared';
import { CentersService } from './centers.service';
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  Public,
  GlobalRoles,
  CenterRoles,
  CenterIdParam,
} from '../common/decorators/auth.decorators';
import { GlobalRolesGuard } from '../common/guards/global-roles.guard';
import { CenterAccessGuard } from '../common/guards/center-access.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';

@Controller('centers')
export class CentersController {
  constructor(private centersService: CentersService) {}

  /** Anyone logged in can apply to open a center */
  @Post('apply')
  apply(@CurrentUser() user: RequestUser, @Body() dto: ApplyCenterDto) {
    return this.centersService.apply(user.id, dto);
  }

  @Public()
  @Get('by-code/:code')
  getCenterByCode(@Param('code') code: string) {
    return this.centersService.getCenterByCode(code);
  }

  @Post('join-by-code')
  joinByCode(
    @CurrentUser() user: RequestUser,
    @Body('code') code: string,
    @Body('batchId') batchId?: string,
  ) {
    return this.centersService.joinByCode(user.id, code, batchId);
  }

  @Get('my')
  myCenters(@CurrentUser() user: RequestUser) {
    return this.centersService.getMyCenters(user.id);
  }

  /** Super Admin: list all centers */
  @Get()
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  listCenters() {
    return this.centersService.listCenters();
  }

  /** Super Admin: list all users in the system */
  @Get('users')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  listUsers() {
    return this.centersService.listAllUsers();
  }

  /** Super Admin: change a membership role */
  @Patch('memberships/:membershipId/role')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  updateMembershipRole(
    @Param('membershipId') membershipId: string,
    @Body('role') role: CenterMemberRole,
  ) {
    return this.centersService.updateMembershipRole(membershipId, role);
  }

  /** Super Admin: list all linked YouTube channels */
  @Get('youtube-channels')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  listAllYoutubeChannels() {
    return this.centersService.listAllYoutubeChannels();
  }

  /** Super Admin: pending applications */
  @Get('applications')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  listApplications(@Query('status') status?: ApplicationStatus) {
    return this.centersService.listApplications(status);
  }

  @Patch('applications/:id/review')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  reviewApplication(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: ReviewApplicationDto,
  ) {
    return this.centersService.reviewApplication(id, user.id, dto);
  }

  @Get(':centerId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(
    CenterMemberRole.STUDENT,
    CenterMemberRole.STAFF,
    CenterMemberRole.TEACHER,
    CenterMemberRole.ADMIN,
  )
  getCenter(@Param('centerId') centerId: string) {
    return this.centersService.getCenter(centerId);
  }

  @Patch(':centerId/subscription')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  updateSubscription(
    @Param('centerId') centerId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.centersService.updateSubscription(centerId, dto);
  }

  @Patch(':centerId/suspend')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  suspend(@Param('centerId') centerId: string) {
    return this.centersService.suspendCenter(centerId);
  }

  @Patch(':centerId/activate')
  @UseGuards(GlobalRolesGuard)
  @GlobalRoles(GlobalRole.SUPER_ADMIN)
  activate(@Param('centerId') centerId: string) {
    return this.centersService.activateCenter(centerId);
  }

  @Patch(':centerId/join-code')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN)
  updateJoinCode(@Param('centerId') centerId: string, @Body('code') code: string) {
    return this.centersService.updateJoinCode(centerId, code);
  }

  @Get(':centerId/members')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listMembers(@Param('centerId') centerId: string) {
    return this.centersService.listMembers(centerId);
  }

  @Get(':centerId/pending-members')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  listPendingMembers(@Param('centerId') centerId: string, @CurrentUser() user: RequestUser) {
    return this.centersService.listPendingMembers(centerId, user.id);
  }

  @Patch(':centerId/members/:membershipId/approve')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  approveMember(
    @Param('centerId') centerId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.centersService.approveMember(centerId, membershipId, user.id);
  }

  @Post(':centerId/members')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN)
  inviteMember(@Param('centerId') centerId: string, @Body() dto: InviteMemberDto) {
    return this.centersService.inviteMember(centerId, dto);
  }

  @Patch(':centerId/members/:membershipId/role')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN)
  updateCenterMemberRole(
    @Param('centerId') centerId: string,
    @Param('membershipId') membershipId: string,
    @Body('role') role: CenterMemberRole,
  ) {
    return this.centersService.updateCenterMemberRole(centerId, membershipId, role);
  }

  @Delete(':centerId/members/:membershipId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN)
  removeMember(
    @Param('centerId') centerId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.centersService.removeMember(centerId, membershipId);
  }

  // ─── Batches ──────────────────────────────────────────────────────────────
  @Get(':centerId/batches')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listBatches(@Param('centerId') centerId: string) {
    return this.centersService.listBatches(centerId);
  }

  @Post(':centerId/batches')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  createBatch(@Param('centerId') centerId: string, @Body() dto: CreateBatchDto) {
    return this.centersService.createBatch(centerId, dto);
  }

  @Delete(':centerId/batches/:batchId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  deleteBatch(@Param('centerId') centerId: string, @Param('batchId') batchId: string) {
    return this.centersService.deleteBatch(centerId, batchId);
  }

  @Patch(':centerId/batches/:batchId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  updateBatch(
    @Param('centerId') centerId: string,
    @Param('batchId') batchId: string,
    @Body() dto: { name: string; description?: string },
  ) {
    return this.centersService.updateBatch(centerId, batchId, dto);
  }

  @Post(':centerId/batches/:batchId/members')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  assignBatchMember(
    @Param('centerId') centerId: string,
    @Param('batchId') batchId: string,
    @Body() dto: AssignBatchMemberDto,
  ) {
    return this.centersService.assignBatchMember(centerId, batchId, dto);
  }

  @Delete(':centerId/batches/:batchId/members/:membershipId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  removeBatchMember(
    @Param('centerId') centerId: string,
    @Param('batchId') batchId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.centersService.removeBatchMember(centerId, batchId, membershipId);
  }

  // ─── Courses & Content ───────────────────────────────────────────────────
  @Get(':centerId/courses')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listCourses(@Param('centerId') centerId: string) {
    return this.centersService.listCourses(centerId);
  }

  @Post(':centerId/courses')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  createCourse(@Param('centerId') centerId: string, @Body() dto: CreateCourseDto) {
    return this.centersService.createCourse(centerId, dto);
  }

  @Patch(':centerId/courses/:courseId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  updateCourse(
    @Param('centerId') centerId: string,
    @Param('courseId') courseId: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.centersService.updateCourse(centerId, courseId, dto);
  }

  @Post(':centerId/courses/:courseId/subjects')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  createSubject(
    @Param('centerId') centerId: string,
    @Param('courseId') courseId: string,
    @Body() dto: CreateSubjectDto,
  ) {
    return this.centersService.createSubject(centerId, courseId, dto);
  }

  @Post(':centerId/subjects/:subjectId/chapters')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  createChapter(
    @Param('centerId') centerId: string,
    @Param('subjectId') subjectId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.centersService.createChapter(centerId, subjectId, dto);
  }

  @Post(':centerId/chapters/:chapterId/videos')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  createVideo(
    @Param('centerId') centerId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateVideoDto,
  ) {
    return this.centersService.createVideo(centerId, chapterId, dto);
  }

  @Post(':centerId/chapters/:chapterId/notes')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  createNote(
    @Param('centerId') centerId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateNoteDto,
  ) {
    return this.centersService.createNote(centerId, chapterId, dto);
  }

  @Get(':centerId/notes')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listNotes(@Param('centerId') centerId: string) {
    return this.centersService.listNotes(centerId);
  }

  @Get(':centerId/videos')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listVideos(
    @Param('centerId') centerId: string,
    @CurrentUser() user: RequestUser,
    @Query('channelId') channelId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.centersService.listVideos(centerId, user.id, channelId, pageNum, limitNum);
  }

  @Get(':centerId/videos/:videoId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  getVideo(
    @Param('centerId') centerId: string,
    @Param('videoId') videoId: string,
  ) {
    return this.centersService.getVideo(centerId, videoId);
  }

  @Get(':centerId/shorts')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listShorts(
    @Param('centerId') centerId: string,
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    return this.centersService.listShorts(centerId, user.id, limit ? parseInt(limit, 10) : 12);
  }

  @Post(':centerId/videos/:videoId/like')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.TEACHER, CenterMemberRole.STAFF, CenterMemberRole.ADMIN)
  toggleLikeVideo(
    @Param('centerId') centerId: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.centersService.toggleLikeVideo(centerId, videoId, user.id);
  }

  @Post(':centerId/playlists/:playlistId/like')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.TEACHER, CenterMemberRole.STAFF, CenterMemberRole.ADMIN)
  toggleLikePlaylist(
    @Param('centerId') centerId: string,
    @Param('playlistId') playlistId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.centersService.toggleLikePlaylist(centerId, playlistId, user.id);
  }

  @Get(':centerId/library')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.TEACHER, CenterMemberRole.STAFF, CenterMemberRole.ADMIN)
  getLibrary(
    @Param('centerId') centerId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.centersService.getLibrary(centerId, user.id);
  }

  @Get(':centerId/youtube/channels')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listYoutubeChannels(
    @Param('centerId') centerId: string,
    @Query('batchId') batchId?: string,
  ) {
    return this.centersService.listYoutubeChannels(centerId, batchId);
  }

  @Get(':centerId/youtube/channels/:channelId/playlists')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listChannelPlaylists(
    @Param('centerId') centerId: string,
    @Param('channelId') channelId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.centersService.listChannelPlaylists(centerId, channelId, user.id);
  }

  @Get(':centerId/playlists/:playlistId/videos')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.TEACHER, CenterMemberRole.STAFF, CenterMemberRole.ADMIN)
  listPlaylistVideos(
    @Param('centerId') centerId: string,
    @Param('playlistId') playlistId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.centersService.listPlaylistVideos(centerId, playlistId, user.id);
  }

  @Post(':centerId/youtube/channels')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  createYoutubeChannel(@Param('centerId') centerId: string, @Body() dto: CreateYoutubeChannelDto) {
    return this.centersService.createYoutubeChannel(centerId, dto);
  }

  @Delete(':centerId/youtube/channels/:channelId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  deleteYoutubeChannel(@Param('centerId') centerId: string, @Param('channelId') channelId: string) {
    return this.centersService.deleteYoutubeChannel(centerId, channelId);
  }

  @Post(':centerId/youtube/channels/:channelId/sync')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  syncYoutubeChannelVideos(
    @Param('centerId') centerId: string,
    @Param('channelId') channelId: string,
    @Query('force') force?: string,
  ) {
    return this.centersService.syncYoutubeChannelVideos(channelId, force === 'true', centerId);
  }

  @Get(':centerId/youtube/channels/:channelId/sync-status')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  getSyncStatus(@Param('centerId') centerId: string, @Param('channelId') channelId: string) {
    return this.centersService.getSyncStatus(channelId);
  }

  @Delete(':centerId/youtube/channels/:channelId/sync')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  cancelSync(@Param('centerId') centerId: string, @Param('channelId') channelId: string) {
    return this.centersService.cancelSync(channelId);
  }

  @Post(':centerId/media/upload')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(
    @Param('centerId') centerId: string,
    @UploadedFile() file: any
  ) {
    return this.centersService.uploadMedia(centerId, file);
  }

  @Get(':centerId/media')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  listMedia(@Param('centerId') centerId: string) {
    return this.centersService.listMedia(centerId);
  }

  // ─── Tests & MCQ Quizzes ────────────────────────────────────────────────────
  @Get(':centerId/tests')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT, CenterMemberRole.STAFF, CenterMemberRole.TEACHER, CenterMemberRole.ADMIN)
  listTests(@Param('centerId') centerId: string) {
    return this.centersService.listTests(centerId);
  }

  @Post(':centerId/tests')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER)
  createTest(@Param('centerId') centerId: string, @Body() dto: CreateTestDto) {
    return this.centersService.createTest(centerId, dto);
  }

  @Post(':centerId/tests/:testId/questions')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER)
  createQuestion(
    @Param('centerId') centerId: string,
    @Param('testId') testId: string,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.centersService.createQuestion(centerId, testId, dto);
  }

  @Post(':centerId/tests/:testId/submit')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT)
  submitTest(
    @Param('centerId') centerId: string,
    @Param('testId') testId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: SubmitTestDto,
  ) {
    // Need student's center membership ID
    // We can fetch membership ID inside the service or retrieve from context if request.user holds centerMembership
    const membershipId = (user as any).centerMembership?.id;
    return this.centersService.submitTest(centerId, testId, membershipId, dto);
  }

  @Get(':centerId/tests/:testId/results')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  getTestResults(@Param('centerId') centerId: string, @Param('testId') testId: string) {
    return this.centersService.getTestResults(centerId, testId);
  }

  // ─── Student Progress Tracking ──────────────────────────────────────────────
  @Post(':centerId/progress/:videoId')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.STUDENT)
  updateProgress(
    @Param('centerId') centerId: string,
    @Param('videoId') videoId: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProgressDto,
  ) {
    const membershipId = (user as any).centerMembership?.id;
    return this.centersService.updateProgress(centerId, videoId, membershipId, dto);
  }

  @Get(':centerId/progress/report')
  @UseGuards(CenterAccessGuard)
  @CenterIdParam('centerId')
  @CenterRoles(CenterMemberRole.ADMIN, CenterMemberRole.TEACHER, CenterMemberRole.STAFF)
  getProgressReport(@Param('centerId') centerId: string, @Query('batchId') batchId?: string) {
    return this.centersService.getProgressReport(centerId, batchId);
  }
}
