import { vi } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Create a deep mock of PrismaClient
export const prismaMock = mockDeep<PrismaClient>();

// Reset mock before each test
export function resetPrismaMock() {
  mockReset(prismaMock);
}

// Mock the db module
vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

export type PrismaMock = DeepMockProxy<PrismaClient>;
