import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '../../../lib/prisma';
import { cookies } from 'next/headers';
import { getUserWithClient, canUserCreateAgent, getClientAgents } from '../../../lib/client';

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

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all agents for user's client
    const agents = await getClientAgents(user.id);

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, tone, instructions, chatWidgetConfig } = body;

    if (!name || !tone || !instructions) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user can create agents
    const { canCreate, reason } = await canUserCreateAgent(user.id);
    if (!canCreate) {
      return NextResponse.json({ error: reason }, { status: 403 });
    }

    // Get user's client info
    const userWithClient = await getUserWithClient(user.id);
    if (!userWithClient) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create the agent
    const agent = await prisma.agent.create({
      data: {
        clientId: userWithClient.clientId,
        createdById: user.id,
        name,
        tone,
        instructions,
        chatWidgetConfig: chatWidgetConfig || {
          primary_color: '#3B82F6',
          initial_greeting: 'Hi! How can I help you today?',
          position: 'bottom-right',
        },
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
            knowledgeBase: true,
            conversations: true,
          },
        },
      },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 