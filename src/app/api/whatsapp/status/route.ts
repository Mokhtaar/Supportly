import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if required Twilio environment variables are configured
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

    const configured = !!(accountSid && authToken && whatsappFrom);

    return NextResponse.json({
      configured,
      details: {
        hasAccountSid: !!accountSid,
        hasAuthToken: !!authToken,
        hasWhatsappFrom: !!whatsappFrom,
      },
    });
  } catch (error) {
    console.error('Error checking Twilio status:', error);
    return NextResponse.json({ 
      configured: false,
      error: 'Failed to check Twilio configuration' 
    }, { status: 500 });
  }
} 