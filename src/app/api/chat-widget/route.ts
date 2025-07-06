import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSystemPrompt } from '@/lib/context';
import { findOrCreateConversation, addMessageToConversation } from "@/lib/conversation";
import { z } from 'zod';

const ChatWidgetRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(2000), // Validate content length
  })).max(10), // Limit conversation context
  widgetKey: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, widgetKey } = ChatWidgetRequestSchema.parse(body);
    
    // CSRF protection
    const xRequestedWith = request.headers.get('x-requested-with');
    if (xRequestedWith !== 'XMLHttpRequest') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    // Additional content validation
    if (lastMessage.content.trim().length === 0) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    // Validate domain if we have a referer
    const referer = request.headers.get('referer');
    
    // Get agent by widgetKey (more secure than agentId)
    const agent = await prisma.agent.findUnique({
      where: { 
        widgetKey: widgetKey,
        isActive: true, // Only active agents
      },
      include: {
        knowledgeBase: {
          where: { processingStatus: 'COMPLETED' },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found or inactive' }, { status: 404 });
    }

    // Validate domain if domains are configured
    if (agent.allowedDomains.length > 0 && referer) {
      const refererDomain = new URL(referer).hostname;
      const isAllowed = agent.allowedDomains.some(domain => {
        // Support wildcard subdomains (e.g., "*.example.com")
        if (domain.startsWith('*.')) {
          const baseDomain = domain.slice(2);
          return refererDomain === baseDomain || refererDomain.endsWith('.' + baseDomain);
        }
        return refererDomain === domain;
      });

      if (!isAllowed) {
        return NextResponse.json({ 
          error: `Domain '${refererDomain}' not allowed for this widget` 
        }, { status: 403 });
      }
    }

    // Create system prompt
    const systemPrompt = await createSystemPrompt(agent, lastMessage.content, agent.id);

    // Only use the last few messages for context to avoid token limits
    const contextMessages = messages.slice(-5);

    console.log(`Widget chat for agent ${agent.id}: ${contextMessages.length} messages`);

    // Generate AI response
    const startTime = Date.now();
    const { text: aiResponse } = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: contextMessages,
      temperature: 0.7,
      maxTokens: 500,
    });

    const responseTime = Date.now() - startTime;

    // Store chat history for widget conversations (optional, no user ID)
    const sessionId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Find or create conversation for this session
      const conversation = await findOrCreateConversation({
        agentId: agent.id,
        sessionId: sessionId,
        channel: "WEB",
      });

      // Save user message
      await addMessageToConversation({
        conversationId: conversation.id,
        role: "USER",
        content: lastMessage.content,
      });

      // Save assistant response
      await addMessageToConversation({
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: aiResponse,
        responseTimeMs: responseTime,
      });
    } catch (error) {
      console.error('Error saving widget chat history:', error);
      // Continue even if history saving fails
    }

    return NextResponse.json({ 
      message: aiResponse,
      agentName: agent.name,
    }, {
      headers: {
        'Content-Security-Policy': "default-src 'self'; connect-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });

  } catch (error) {
    console.error('Error in chat widget API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 