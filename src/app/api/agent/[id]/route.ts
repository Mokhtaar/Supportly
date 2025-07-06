import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '../../../../lib/prisma';
import { cookies } from 'next/headers';
import { canUserAccessAgent, getUserWithClient } from '../../../../lib/client';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agentId } = await params;

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // Get the agent with related data
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        createdBy: {
          select: {
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        knowledgeBase: {
          orderBy: {
            uploadedAt: 'desc',
          },
        },
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agentId } = await params;

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    const body = await request.json();
    const { name, tone, instructions, chatWidgetConfig, whatsappNumber, allowedDomains } = body;

    // Update the agent
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        name,
        tone,
        instructions,
        whatsappNumber,
        allowedDomains: allowedDomains || [],
        chatWidgetConfig: chatWidgetConfig || {
          primary_color: '#3B82F6',
          initial_greeting: 'Hi! How can I help you today?',
          position: 'bottom-right',
        },
        updatedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            email: true,
          },
        },
        knowledgeBase: true,
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: agentId } = await params;

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // Check if user has permission to delete agents (only OWNER/ADMIN)
    const userWithClient = await getUserWithClient(user.id);
    if (!userWithClient || !['OWNER', 'ADMIN'].includes(userWithClient.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Soft delete the agent
    await prisma.agent.update({
      where: { id: agentId },
      data: { isActive: false },
    });

    return NextResponse.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 