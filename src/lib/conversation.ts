import { prisma } from './prisma';
import { Prisma } from '../generated/prisma';

export interface ConversationData {
  agentId: string;
  sessionId: string;
  userId?: string;
  channel: 'WEB' | 'WHATSAPP' | 'TELEGRAM' | 'API';
  userEmail?: string;
  userPhone?: string;
}

export interface MessageData {
  conversationId: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  contentType?: string;
  responseTimeMs?: number;
  tokensUsed?: number;
  metadata?: Prisma.InputJsonValue;
}

export async function findOrCreateConversation(data: ConversationData) {
  // Try to find existing conversation by agent + sessionId
  let conversation = await prisma.conversation.findFirst({
    where: {
      agentId: data.agentId,
      sessionId: data.sessionId,
    },
  });

  // If no conversation exists, create one
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        agentId: data.agentId,
        sessionId: data.sessionId,
        userId: data.userId,
        channel: data.channel,
        userEmail: data.userEmail,
        userPhone: data.userPhone,
        status: 'ACTIVE',
        priority: 'NORMAL',
        lastMessageAt: new Date(),
        messageCount: 0,
      },
    });
  }

  return conversation;
}

export async function addMessageToConversation(data: MessageData) {
  return await prisma.$transaction(async (tx) => {
    // Create the message
    const message = await tx.message.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        contentType: data.contentType || 'text',
        responseTimeMs: data.responseTimeMs,
        tokensUsed: data.tokensUsed,
        metadata: data.metadata,
      },
    });

    // Update conversation stats
    await tx.conversation.update({
      where: { id: data.conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: {
          increment: 1,
        },
      },
    });

    return message;
  });
}

export async function getConversationMessages(conversationId: string, limit = 50) {
  return await prisma.message.findMany({
    where: { conversationId },
    orderBy: { timestamp: 'asc' },
    take: limit,
  });
}

export async function getConversationHistory(agentId: string, sessionId: string) {
  // Find the conversation
  const conversation = await prisma.conversation.findFirst({
    where: {
      agentId,
      sessionId,
    },
    include: {
      messages: {
        orderBy: { timestamp: 'asc' },
      },
    },
  });

  if (!conversation) {
    return [];
  }

  // Transform messages to the expected format
  return conversation.messages.map(msg => ({
    role: msg.role.toLowerCase() as 'user' | 'assistant',
    content: msg.content,
  }));
} 