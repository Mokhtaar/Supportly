import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSystemPrompt } from '@/lib/context';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { 
  sendWhatsAppMessage, 
  parseTwilioWhatsAppWebhook, 
  // validateTwilioSignature, // Temporarily disabled for dev
  extractPhoneNumber 
} from '@/lib/twilio';
import { findOrCreateConversation, addMessageToConversation } from '@/lib/conversation';

// WhatsApp webhook verification (for initial setup)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const url = new URL(request.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    // Verify webhook
    if (mode === 'subscribe' && token === `supportgenius_${agentId.slice(0, 8)}`) {
      console.log('WhatsApp webhook verified for agent:', agentId);
      return new NextResponse(challenge);
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  } catch (error) {
    console.error('Error verifying WhatsApp webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle incoming Twilio WhatsApp messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    
    // Parse form data from Twilio (not JSON)
    const formData = await request.formData();
    const body: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      body[key] = value.toString();
    }

    console.log('Twilio WhatsApp webhook received:', body);

    // Validate Twilio signature for security
    // NOTE: Temporarily disabled for development with ngrok
    // const twilioSignature = request.headers.get('x-twilio-signature');
    // if (twilioSignature && process.env.TWILIO_AUTH_TOKEN) {
    //   const url = request.url;
    //   const isValid = validateTwilioSignature(
    //     process.env.TWILIO_AUTH_TOKEN,
    //     twilioSignature,
    //     url,
    //     body
    //   );
      
    //   if (!isValid) {
    //     console.error('Invalid Twilio signature');
    //     return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    //   }
    // }

    // Parse the Twilio message
    const message = parseTwilioWhatsAppWebhook(body);
    if (!message) {
      console.log('No valid message found in webhook');
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const { from, body: messageText } = message;
    const phoneNumber = extractPhoneNumber(from);

    if (!messageText) {
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Get agent configuration
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        client: true,
        knowledgeBase: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!agent || !agent.isActive) {
      console.log('Agent not found or inactive:', agentId);
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Check if agent has WhatsApp configured
    if (!agent.whatsappNumber) {
      console.log('Agent has no WhatsApp number configured:', agentId);
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    // Create system prompt with knowledge base context
    const systemPrompt = await createSystemPrompt(agent, messageText, agentId);

    // Generate AI response
    const { text: aiResponse } = await generateText({
      model: openai('gpt-3.5-turbo'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageText },
      ],
      temperature: 0.7,
      maxTokens: 500,
    });

    // Store incoming user message
    const sessionId = `whatsapp_${phoneNumber}`;
    
    try {
      // Find or create conversation
      const conversation = await findOrCreateConversation({
        agentId: agentId,
        sessionId: sessionId,
        channel: 'WHATSAPP',
        userPhone: phoneNumber,
      });

      // Save user message
      await addMessageToConversation({
        conversationId: conversation.id,
        role: 'USER',
        content: messageText,
      });

      // Save assistant response
      await addMessageToConversation({
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: aiResponse,
      });
    } catch (error) {
      console.error('Error saving messages to conversation:', error);
      // Continue even if saving fails
    }

    // Send response back to WhatsApp via Twilio
    const sendResult = await sendWhatsAppMessage(from, aiResponse);
    
    if (!sendResult.success) {
      console.error('Failed to send WhatsApp response:', sendResult.error);
    } else {
      console.log('WhatsApp response sent successfully:', {
        messageId: sendResult.messageId,
        to: from,
        response: aiResponse,
      });
    }

    // Return empty TwiML response (Twilio expects XML, not JSON)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });

  } catch (error) {
    console.error('Error processing Twilio WhatsApp message:', error);
    
    // Return empty TwiML response even on error
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }
} 