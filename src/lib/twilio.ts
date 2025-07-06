import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM; // Twilio Sandbox number

if (!accountSid || !authToken) {
  console.warn('Twilio credentials not found. WhatsApp functionality will be disabled.');
}

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Send a WhatsApp message using Twilio
 */
export async function sendWhatsAppMessage(
  to: string, // Phone number in format: whatsapp:+1234567890
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!twilioClient) {
    return {
      success: false,
      error: 'Twilio client not initialized. Please check your credentials.',
    };
  }

  try {
    // Ensure the 'to' number is in the correct WhatsApp format
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    const twilioMessage = await twilioClient.messages.create({
      from: whatsappFrom,
      to: formattedTo,
      body: message,
    });

    console.log('WhatsApp message sent successfully:', {
      messageId: twilioMessage.sid,
      to: formattedTo,
      status: twilioMessage.status,
    });

    return {
      success: true,
      messageId: twilioMessage.sid,
    };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Validate Twilio webhook signature for security
 */
export function validateTwilioSignature(
  authToken: string,
  twilioSignature: string,
  url: string,
  params: Record<string, string | string[]>
): boolean {
  if (!authToken) return false;
  
  try {
    return twilio.validateRequest(
      authToken,
      twilioSignature,
      url,
      params
    );
  } catch (error) {
    console.error('Error validating Twilio signature:', error);
    return false;
  }
}

/**
 * Parse incoming Twilio WhatsApp webhook payload
 */
export interface TwilioWhatsAppMessage {
  messageId: string;
  from: string; // e.g., "whatsapp:+1234567890"
  to: string;   // e.g., "whatsapp:+14155238886"
  body: string;
  mediaUrl?: string;
  mediaContentType?: string;
  profileName?: string;
}

export function parseTwilioWhatsAppWebhook(body: Record<string, string>): TwilioWhatsAppMessage | null {
  try {
    // Twilio sends form-encoded data, not JSON
    if (!body.MessageSid || !body.From || !body.Body) {
      return null;
    }

    return {
      messageId: body.MessageSid,
      from: body.From, // whatsapp:+1234567890
      to: body.To,     // whatsapp:+14155238886
      body: body.Body,
      mediaUrl: body.MediaUrl0, // First media attachment if any
      mediaContentType: body.MediaContentType0,
      profileName: body.ProfileName,
    };
  } catch (error) {
    console.error('Error parsing Twilio webhook:', error);
    return null;
  }
}

/**
 * Extract phone number from WhatsApp format
 */
export function extractPhoneNumber(whatsappNumber: string): string {
  // Convert "whatsapp:+1234567890" to "+1234567890"
  return whatsappNumber.replace('whatsapp:', '');
}

/**
 * Format phone number for WhatsApp
 */
export function formatWhatsAppNumber(phoneNumber: string): string {
  // Convert "+1234567890" to "whatsapp:+1234567890"
  if (phoneNumber.startsWith('whatsapp:')) {
    return phoneNumber;
  }
  
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = '+' + phoneNumber;
  }
  
  return `whatsapp:${phoneNumber}`;
} 