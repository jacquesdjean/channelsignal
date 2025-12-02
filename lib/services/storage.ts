import { mkdir, writeFile, readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { createId } from '@paralleldrive/cuid2';

export interface StorageService {
  store(userId: string, filename: string, data: Buffer): Promise<string>;
  retrieve(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

class LocalStorageService implements StorageService {
  private basePath: string;

  constructor(basePath: string = STORAGE_PATH) {
    this.basePath = basePath;
  }

  private getFullPath(key: string): string {
    return join(this.basePath, key);
  }

  async store(userId: string, filename: string, data: Buffer): Promise<string> {
    const uniqueId = createId();
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const key = `${userId}/${uniqueId}${ext ? `.${ext}` : ''}`;
    const fullPath = this.getFullPath(key);
    const dirPath = join(this.basePath, userId);

    // Ensure directory exists
    await mkdir(dirPath, { recursive: true });

    // Write file
    await writeFile(fullPath, data);

    return key;
  }

  async retrieve(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    return readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    await unlink(fullPath);
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(key);
      await stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const storage: StorageService = new LocalStorageService();
