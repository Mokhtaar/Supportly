import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '../../../../../lib/prisma';
import { cookies } from 'next/headers';
import { canUserAccessAgent, getUserWithClient } from '../../../../../lib/client';
import { randomUUID } from 'crypto';

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

export async function POST(
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

    // Check if user has permission to regenerate keys (only OWNER/ADMIN)
    const userWithClient = await getUserWithClient(user.id);
    if (!userWithClient || !['OWNER', 'ADMIN'].includes(userWithClient.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Generate new widget key
    const newWidgetKey = randomUUID();

    // Update the agent with new widget key
    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        widgetKey: newWidgetKey,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        widgetKey: true,
      },
    });

    return NextResponse.json({ 
      message: 'Widget key regenerated successfully',
      widgetKey: agent.widgetKey,
    });
  } catch (error) {
    console.error('Error regenerating widget key:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 