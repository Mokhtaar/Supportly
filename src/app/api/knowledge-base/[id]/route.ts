import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '../../../../lib/prisma';
import { deleteKnowledgeBaseFromPinecone } from '../../../../lib/pinecone';
import { canUserAccessAgent } from '../../../../lib/client';
import { cookies } from 'next/headers';

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get the knowledge base item with its agent
    const knowledgeBaseItem = await prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        agent: true,
      },
    });

    if (!knowledgeBaseItem) {
      return NextResponse.json({ error: 'Knowledge base item not found' }, { status: 404 });
    }

    // Check if user can access the agent that owns this knowledge base
    const canAccess = await canUserAccessAgent(user.id, knowledgeBaseItem.agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from Pinecone first
    try {
      await deleteKnowledgeBaseFromPinecone(id, knowledgeBaseItem.agentId);
    } catch (pineconeError) {
      console.error('Error deleting from Pinecone:', pineconeError);
      // Continue with database deletion even if Pinecone fails
    }

    // Delete from database
    await prisma.knowledgeBase.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Knowledge base item deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge base item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 