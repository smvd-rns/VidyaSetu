import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UploadFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface StoredFile {
  url: string;
  fileName: string;
  fileSize: number;
}

/** Storage abstraction — swap provider via STORAGE_PROVIDER env only */
@Injectable()
export class StorageService {
  constructor(private config: ConfigService) {}

  async save(file: UploadFile, folder: string): Promise<StoredFile> {
    const provider = this.config.get('STORAGE_PROVIDER', 'local');

    if (provider === 'local') {
      return this.saveLocal(file, folder);
    }

    throw new Error(`Storage provider "${provider}" not configured yet. Use STORAGE_PROVIDER=local for free dev.`);
  }

  private async saveLocal(file: UploadFile, folder: string): Promise<StoredFile> {
    const basePath = this.config.get('STORAGE_LOCAL_PATH', './uploads');
    const dir = path.join(basePath, folder);
    await fs.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname);
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(dir, fileName);
    await fs.writeFile(filePath, file.buffer);

    const publicUrl = `/uploads/${folder}/${fileName}`;
    return { url: publicUrl, fileName: file.originalname, fileSize: file.size };
  }
}
