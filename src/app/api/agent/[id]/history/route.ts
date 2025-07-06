import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { canUserAccessAgent } from '@/lib/client';
import { Prisma } from '@/generated/prisma';

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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const channel = searchParams.get('channel'); // Optional filter by channel
    const conversationId = searchParams.get('conversationId'); // Optional filter by conversation

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // Build where clause for conversations
    const where: Prisma.ConversationWhereInput = {
      agentId: agentId,
    };

    if (channel) {
      where.channel = channel as Prisma.EnumChannelFilter;
    }

    if (conversationId) {
      where.id = conversationId;
    }

    // If requesting a specific conversation, return its messages
    if (conversationId) {
      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversationId,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
        skip: offset,
      });

      return NextResponse.json({
        data: messages,
        pagination: {
          total: messages.length,
          limit,
          offset,
          hasMore: false,
        },
      });
    }

    // Get conversations with message counts and latest messages
    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: {
        lastMessageAt: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        messages: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 1, // Get only the latest message for preview
        },
      },
    });

    // Count total conversations for pagination
    const totalConversations = await prisma.conversation.count({
      where,
    });

    // Get conversation statistics
    const conversationStats = await prisma.conversation.groupBy({
      by: ['channel'],
      where: {
        agentId: agentId,
      },
      _count: {
        id: true,
      },
      _sum: {
        messageCount: true,
      },
    });

    const stats = {
      totalSessions: totalConversations,
      totalMessages: conversationStats.reduce((sum, stat) => sum + (stat._sum.messageCount || 0), 0),
      channelBreakdown: conversationStats.reduce((acc, stat) => {
        const channel = stat.channel || 'UNKNOWN';
        if (!acc[channel]) {
          acc[channel] = { sessions: 0, messages: 0 };
        }
        acc[channel].sessions = stat._count.id;
        acc[channel].messages = stat._sum.messageCount || 0;
        return acc;
      }, {} as Record<string, { sessions: number; messages: number }>),
    };

    // Transform conversations to match the expected format
    const result = conversations.map(conv => ({
      sessionId: conv.sessionId,
      channel: conv.channel,
      lastActivity: conv.lastMessageAt,
      messageCount: conv.messageCount,
      status: conv.status,
      priority: conv.priority,
      title: conv.title,
      summary: conv.summary,
      tags: conv.tags,
      user: conv.user,
      messages: conv.messages,
      // Add conversation ID for future reference
      conversationId: conv.id,
    }));

    return NextResponse.json({
      data: result,
      pagination: {
        total: totalConversations,
        limit,
        offset,
        hasMore: totalConversations > offset + limit,
      },
      stats,
    });

  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 