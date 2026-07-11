import { Module } from '@nestjs/common';
import { CentersService } from './centers.service';
import { CentersController } from './centers.controller';
import { CenterAccessGuard } from '../common/guards/center-access.guard';
import { GoogleDriveService } from './google-drive.service';
import { RedisService } from './redis.service';
import { StorageService } from '../storage/storage.service';

@Module({
  controllers: [CentersController],
  providers: [CentersService, CenterAccessGuard, GoogleDriveService, RedisService, StorageService],
  exports: [CentersService],
})
export class CentersModule {}
