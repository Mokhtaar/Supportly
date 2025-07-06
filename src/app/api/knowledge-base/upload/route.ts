import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '../../../../lib/prisma';
import { processDocument } from '../../../../lib/documentProcessor';
import { canUserAccessAgent } from '../../../../lib/client';
import { cookies } from 'next/headers';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';

async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const agentId = formData.get('agentId') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PDF, TXT, and MD files are supported' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.access(uploadsDir);
    } catch {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Save file temporarily
    const fileExtension = path.extname(file.name);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filePath, buffer);

    // Create knowledge base entry
    const knowledgeBaseItem = await prisma.knowledgeBase.create({
      data: {
        agentId: agent.id,
        fileName: fileName,
        originalName: file.name,
        fileType: file.type,
        fileSize: file.size,
        processingStatus: 'PENDING',
      },
    });

    // Process document asynchronously
    processDocumentAsync(knowledgeBaseItem.id, filePath, file.type);

    return NextResponse.json(knowledgeBaseItem);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processDocumentAsync(knowledgeBaseId: string, filePath: string, fileType: string) {
  try {
    // Update status to processing
    await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: { processingStatus: 'PROCESSING' },
    });

    // Get the knowledge base item to access agent ID and file name
    const knowledgeBaseItem = await prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
      include: { agent: true },
    });

    if (!knowledgeBaseItem) {
      throw new Error('Knowledge base item not found');
    }

    // Process the document with all required parameters
    const chunks = await processDocument(
      filePath, 
      fileType, 
      knowledgeBaseId,
      knowledgeBaseItem.agentId,
      knowledgeBaseItem.fileName
    );

    // Update with success status and chunk count
    await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: {
        processingStatus: 'COMPLETED',
        chunkCount: chunks.length,
      },
    });

    // Clean up temporary file
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error processing document:', error);
    
    // Update with error status
    await prisma.knowledgeBase.update({
      where: { id: knowledgeBaseId },
      data: {
        processingStatus: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Processing failed',
      },
    });

    // Clean up temporary file on error
    try {
      await fs.unlink(filePath);
    } catch (cleanupError) {
      console.error('Error cleaning up file:', cleanupError);
    }
  }
} 