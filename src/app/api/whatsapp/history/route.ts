import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { canUserAccessAgent } from '@/lib/client';

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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const page = parseInt(searchParams.get('page') || '1');
    const page_size = parseInt(searchParams.get('page_size') || '50');

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // Get conversations with messages for this agent
    const conversations = await prisma.conversation.findMany({
      where: {
        agentId,
        channel: 'WHATSAPP',
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 20, // Limit messages per conversation
        },
      },
      orderBy: {
        lastMessageAt: 'desc',
      },
      take: page_size,
      skip: (page - 1) * page_size,
    });

    // Get total count for pagination
    const totalConversations = await prisma.conversation.count({
      where: {
        agentId,
        channel: 'WHATSAPP',
      },
    });

    // Transform conversations to match expected format
    const formattedConversations = conversations.map(conversation => ({
      sessionId: conversation.sessionId,
      phone: conversation.userPhone,
      messageCount: conversation.messageCount,
      lastMessageAt: conversation.lastMessageAt,
      messages: conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    }));

    return NextResponse.json({
      conversations: formattedConversations,
      pagination: {
        page,
        page_size,
        total: totalConversations,
        total_pages: Math.ceil(totalConversations / page_size),
      },
    });

  } catch (error) {
    console.error('Error fetching WhatsApp history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 