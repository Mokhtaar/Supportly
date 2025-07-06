import { prisma } from './prisma';

/**
 * Get user with their client information
 */
export async function getUserWithClient(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      client: true,
    },
  });
}

/**
 * Create a new client (company) with initial owner user
 */
export async function createClientWithOwner(data: {
  userId: string;
  email: string;
  clientName: string;
  clientSlug: string;
  plan?: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
}) {
  const { userId, email, clientName, clientSlug, plan = 'FREE' } = data;

  return await prisma.$transaction(async (tx) => {
    // Create the client
    const client = await tx.client.create({
      data: {
        name: clientName,
        slug: clientSlug,
        plan,
      },
    });

    // Create the user as owner
    const user = await tx.user.create({
      data: {
        id: userId,
        email,
        clientId: client.id,
        role: 'OWNER',
      },
    });

    return { client, user };
  });
}

/**
 * Check if user has permission to access a specific agent
 */
export async function canUserAccessAgent(userId: string, agentId: string): Promise<boolean> {
  const userWithClient = await getUserWithClient(userId);
  if (!userWithClient) return false;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { clientId: true },
  });

  return agent?.clientId === userWithClient.clientId;
}

/**
 * Check if user can create agents (not exceeding client limits)
 */
export async function canUserCreateAgent(userId: string): Promise<{ canCreate: boolean; reason?: string }> {
  const userWithClient = await getUserWithClient(userId);
  if (!userWithClient) {
    return { canCreate: false, reason: 'User not found' };
  }

  if (!userWithClient.client.isActive) {
    return { canCreate: false, reason: 'Client account is inactive' };
  }

  // Check if user has permission to create agents
  if (!['OWNER', 'ADMIN'].includes(userWithClient.role)) {
    return { canCreate: false, reason: 'Insufficient permissions' };
  }

  // Check client agent limit
  const agentCount = await prisma.agent.count({
    where: { 
      clientId: userWithClient.clientId,
      isActive: true,
    },
  });

  if (agentCount >= userWithClient.client.maxAgents) {
    return { 
      canCreate: false, 
      reason: `Agent limit reached (${userWithClient.client.maxAgents} max)` 
    };
  }

  return { canCreate: true };
}

/**
 * Get all agents for user's client
 */
export async function getClientAgents(userId: string) {
  const userWithClient = await getUserWithClient(userId);
  if (!userWithClient) return [];

  return await prisma.agent.findMany({
    where: { 
      clientId: userWithClient.clientId,
      isActive: true,
    },
    include: {
      createdBy: {
        select: {
          email: true,
        },
      },
      knowledgeBase: {
        where: { processingStatus: 'COMPLETED' },
      },
      _count: {
        select: {
          knowledgeBase: true,
          conversations: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Generate a unique client slug from company name
 */
export function generateClientSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);
}

/**
 * Check if client slug is available
 */
export async function isClientSlugAvailable(slug: string): Promise<boolean> {
  const existing = await prisma.client.findUnique({
    where: { slug },
    select: { id: true },
  });
  return !existing;
} 