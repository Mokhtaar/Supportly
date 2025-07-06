import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { 
  createClientWithOwner, 
  generateClientSlug, 
  isClientSlugAvailable,
  getUserWithClient 
} from '../../../lib/client';
import { z } from 'zod';

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

const OnboardingSchema = z.object({
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  companySlug: z.string().optional(),
  plan: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('user', user);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    // Check if user already has a client
    const existingUser = await getUserWithClient(user.id);
    console.log('existingUser', existingUser);
    if (existingUser) {
      return NextResponse.json({ 
        error: 'User already belongs to a company',
        client: existingUser.client 
      }, { status: 400 });
    }

    const body = await request.json();
    const { companyName, companySlug, plan = 'FREE' } = OnboardingSchema.parse(body);

    // Generate slug from company name if not provided
    let slug = companySlug || generateClientSlug(companyName);
    
    // Ensure slug is unique
    let slugAvailable = await isClientSlugAvailable(slug);
    let slugAttempt = 1;
    
    while (!slugAvailable) {
      slug = `${slug}-${slugAttempt}`;
      slugAvailable = await isClientSlugAvailable(slug);
      slugAttempt++;
      
      // Prevent infinite loop
      if (slugAttempt > 100) {
        return NextResponse.json({ 
          error: 'Unable to generate unique company identifier' 
        }, { status: 500 });
      }
    }

    // Create client and user
    const { client, user: createdUser } = await createClientWithOwner({
      userId: user.id,
      email: user.email,
      clientName: companyName,
      clientSlug: slug,
      plan,
    });

    return NextResponse.json({
      message: 'Company created successfully',
      client: {
        id: client.id,
        name: client.name,
        slug: client.slug,
        plan: client.plan,
        maxUsers: client.maxUsers,
        maxAgents: client.maxAgents,
      },
      user: {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error during onboarding:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.errors 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already has a client
    const userWithClient = await getUserWithClient(user.id);
    
    if (userWithClient) {
      return NextResponse.json({
        hasCompany: true,
        client: {
          id: userWithClient.client.id,
          name: userWithClient.client.name,
          slug: userWithClient.client.slug,
          plan: userWithClient.client.plan,
          maxUsers: userWithClient.client.maxUsers,
          maxAgents: userWithClient.client.maxAgents,
        },
        user: {
          role: userWithClient.role,
        },
      });
    }

    return NextResponse.json({
      hasCompany: false,
      needsOnboarding: true,
    });

  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 