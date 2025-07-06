import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { canUserAccessAgent } from '@/lib/client';
import { sendWhatsAppMessage, formatWhatsAppNumber } from '@/lib/twilio';
import { findOrCreateConversation, addMessageToConversation } from '@/lib/conversation';

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
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, phoneNumber, message } = body;

    if (!agentId || !phoneNumber || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Agent not found or access denied' }, { status: 404 });
    }

    // Get agent configuration
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent || !agent.isActive || !agent.whatsappNumber) {
      return NextResponse.json({ 
        error: 'Agent not found, inactive, or WhatsApp not configured' 
      }, { status: 400 });
    }

    // Format phone number for WhatsApp
    const formattedPhoneNumber = formatWhatsAppNumber(phoneNumber);

    // Send the message via Twilio
    const sendResult = await sendWhatsAppMessage(formattedPhoneNumber, message);

    if (!sendResult.success) {
      return NextResponse.json({
        success: false,
        error: sendResult.error || 'Failed to send message',
      }, { status: 500 });
    }

    // Store the test message in chat history
    const sessionId = `whatsapp_test_${phoneNumber}`;
    
    try {
      // Find or create conversation
      const conversation = await findOrCreateConversation({
        agentId: agentId,
        sessionId: sessionId,
        channel: 'WHATSAPP',
        userPhone: formattedPhoneNumber,
      });

      // Save the sent message
      await addMessageToConversation({
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: message,
      });
    } catch (error) {
      console.error('Error saving message to conversation:', error);
      // Continue even if saving fails
    }

    console.log('Test WhatsApp message sent via Twilio:', {
      agentId,
      phoneNumber: formattedPhoneNumber,
      message,
      messageId: sendResult.messageId,
    });

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageId,
      message: 'WhatsApp message sent successfully via Twilio',
      to: formattedPhoneNumber,
    });

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 