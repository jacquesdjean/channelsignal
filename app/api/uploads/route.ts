import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createId } from '@paralleldrive/cuid2';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

/**
 * GET /api/uploads
 *
 * Returns all uploads for the authenticated user
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const uploads = await prisma.upload.findMany({
      include: {
        channel: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(uploads);
  } catch (error) {
    console.error('Failed to fetch uploads:', error);
    return NextResponse.json({ error: 'Failed to fetch uploads' }, { status: 500 });
  }
}

/**
 * POST /api/uploads
 *
 * Upload a file to a channel
 *
 * Request: multipart/form-data with:
 * - file: the uploaded file
 * - channelId: target channel ID
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const channelId = formData.get('channelId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 413 }
      );
    }

    // Verify channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 400 });
    }

    // Create directory structure
    const uploadDir = join(STORAGE_PATH, channelId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const fileId = createId();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${channelId}/${fileId}-${safeFilename}`;
    const filePath = join(STORAGE_PATH, storageKey);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create database record
    const upload = await prisma.upload.create({
      data: {
        channelId,
        uploadedById: session.user.id,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        storageKey,
      },
    });

    return NextResponse.json(
      {
        id: upload.id,
        filename: upload.filename,
        size: upload.sizeBytes,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
