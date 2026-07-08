import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleDriveService {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private folderId: string;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '');
    this.clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
    this.refreshToken = this.config.get<string>('GOOGLE_REFRESH_TOKEN', '');
    this.folderId = this.config.get<string>('MAIN_DRIVE_FOLDER_ID', '');
  }

  private async getAccessToken(): Promise<string> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to refresh token: ${response.statusText} - ${errorText}`);
      }

      const data = (await response.json()) as { access_token: string };
      return data.access_token;
    } catch (error: any) {
      throw new InternalServerErrorException(`Google OAuth error: ${error.message}`);
    }
  }

  async uploadFile(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const boundary = 'antigravity_boundary_uuid';

    // Construct the metadata part
    const metadata = {
      name: fileName,
      parents: this.folderId ? [this.folderId] : undefined,
    };

    const metadataPart = [
      `\r\n--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      '\r\n',
    ].join('');

    const mediaPartHeader = [
      `--${boundary}\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
    ].join('');

    const mediaPartFooter = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(metadataPart, 'utf8'),
      Buffer.from(mediaPartHeader, 'utf8'),
      buffer,
      Buffer.from(mediaPartFooter, 'utf8'),
    ]);

    try {
      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
            'Content-Length': bodyBuffer.length.toString(),
          },
          body: bodyBuffer,
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Upload failed: ${response.statusText} - ${errText}`);
      }

      const fileData = (await response.json()) as { id: string };
      const fileId = fileData.id;

      // Make file viewable by anyone (public reader permissions)
      await this.makeFilePublic(fileId, accessToken);

      return fileId;
    } catch (error: any) {
      throw new InternalServerErrorException(`Google Drive upload error: ${error.message}`);
    }
  }

  private async makeFilePublic(fileId: string, accessToken: string): Promise<void> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role: 'reader',
            type: 'anyone',
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to set permissions: ${response.statusText} - ${errText}`);
      }
    } catch (error: any) {
      throw new InternalServerErrorException(`Google Drive permissions error: ${error.message}`);
    }
  }
}
