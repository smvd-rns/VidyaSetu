import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private inMemoryCache = new Map<string, { value: string; expiresAt: number }>();

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL', '');

    if (redisUrl) {
      try {
        this.client = new Redis(redisUrl);
        this.logger.log('Successfully connected to Redis server.');
      } catch (err: any) {
        this.logger.error(`Failed to connect to Redis: ${err.message}. Falling back to In-Memory.`);
        this.client = null;
      }
    } else {
      this.logger.warn(
        'REDIS_URL is not configured. Falling back to local In-Memory caching. (Note: Use Redis for production scaling).'
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.client) {
      try {
        const cached = await this.client.get(key);
        if (cached) {
          return JSON.parse(cached) as T;
        }
      } catch (err: any) {
        this.logger.error(`Redis get error: ${err.message}`);
      }
      return null;
    }

    // In-memory fallback
    const cachedItem = this.inMemoryCache.get(key);
    if (!cachedItem) return null;

    if (Date.now() > cachedItem.expiresAt) {
      this.inMemoryCache.delete(key);
      return null;
    }

    return JSON.parse(cachedItem.value) as T;
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value);

    if (this.client) {
      try {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } catch (err: any) {
        this.logger.error(`Redis set error: ${err.message}`);
      }
      return;
    }

    // In-memory fallback
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.inMemoryCache.set(key, { value: serialized, expiresAt });
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
      } catch (err: any) {
        this.logger.error(`Redis del error: ${err.message}`);
      }
      return;
    }

    // In-memory fallback
    this.inMemoryCache.delete(key);
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
      this.logger.log('Disconnected from Redis server.');
    }
  }
}
