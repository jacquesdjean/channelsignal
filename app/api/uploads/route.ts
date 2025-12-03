import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendUploadNotificationEmail } from '@/lib/email';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { createId } from '@paralleldrive/cuid2';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const STORAGE_PATH = process.env.STORAGE_PATH || './uploads';

/**
 * GET /api/uploads
 *
 * Returns uploads filtered by email and/or channelId
 *
 * Query params:
 * - email: Filter by uploader's email
 * - channelId: Filter by channel ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const channelId = searchParams.get('channelId');

    // Build where clause based on filters
    const where: {
      uploadedBy?: { email: string };
      channelId?: string;
    } = {};

    if (email) {
      where.uploadedBy = { email };
    }

    if (channelId) {
      where.channelId = channelId;
    }

    const uploads = await prisma.upload.findMany({
      where,
      include: {
        channel: true,
        uploadedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
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
 * Upload a file with email tagging
 *
 * Request: multipart/form-data with:
 * - file: the uploaded file (required)
 * - email: uploader's email (required)
 * - channelId: target channel ID (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const email = formData.get('email') as string | null;
    const channelId = formData.get('channelId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 413 }
      );
    }

    // Find or create user by email
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { email },
      });
    }

    // If channelId is provided, verify it exists
    let channel = null;
    if (channelId) {
      channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });

      if (!channel) {
        return NextResponse.json({ error: 'Channel not found' }, { status: 400 });
      }
    }

    // Create directory structure
    const uploadDir = channelId
      ? join(STORAGE_PATH, channelId)
      : join(STORAGE_PATH, user.id);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const fileId = createId();
    const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = channelId
      ? `${channelId}/${fileId}-${safeFilename}`
      : `${user.id}/${fileId}-${safeFilename}`;
    const filePath = join(STORAGE_PATH, storageKey);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create database record
    const upload = await prisma.upload.create({
      data: {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        storageKey,
        uploadedById: user.id,
        channelId: channelId || null,
      },
      include: {
        channel: true,
      },
    });

    // Send notification email (non-blocking)
    sendUploadNotificationEmail(
      email,
      file.name,
      file.size,
      channel?.name
    ).catch((error) => {
      console.error('Failed to send upload notification email:', error);
    });

    return NextResponse.json(
      {
        id: upload.id,
        filename: upload.filename,
        size: upload.sizeBytes,
        uploadedBy: email,
        channelId: upload.channelId,
        channelName: upload.channel?.name || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
