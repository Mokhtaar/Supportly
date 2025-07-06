import { queryPinecone } from "./pinecone";
import { prisma } from "./prisma";

/**
 * Get conversation history for a session using the new conversation/message schema
 */
export async function getConversationHistory(
  agentId: string,
  sessionId: string,
  limit = 20
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  try {
    // Find the conversation first
    const conversation = await prisma.conversation.findFirst({
      where: {
        agentId,
        sessionId,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: "asc", // Get chronological order
          },
          take: limit,
          select: {
            role: true,
            content: true,
          },
        },
      },
    });

    if (!conversation) {
      return [];
    }

    // Map to AI SDK format
    return conversation.messages.map((msg) => ({
      role: msg.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    return [];
  }
}

/**
 * Get knowledge base context for a query
 */
export async function getKnowledgeBaseContext(
  query: string,
  agentId: string,
  maxCharacters = 3000
): Promise<string> {
  try {
    const relevantDocs = await queryPinecone(query, agentId);

    if (relevantDocs.length === 0) {
      console.log("no relevant docs found");
      return "";
    }

    // Combine all relevant documents
    const contextText = relevantDocs.map((doc) => doc.text).join("\n\n");

    // Truncate if too long
    return contextText.length > maxCharacters
      ? contextText.substring(0, maxCharacters) + "..."
      : contextText;
  } catch (error) {
    console.error("Error getting knowledge base context:", error);
    return "";
  }
}

/**
 * Create a complete system prompt with agent configuration and context
 */
export async function createSystemPrompt(
  agent: {
    name: string;
    tone: string;
    instructions: string;
    knowledgeBase: { id: string }[];
  },
  query: string,
  agentId: string
): Promise<string> {
  let knowledgeContext = "";

  // Get knowledge base context if agent has knowledge base
  if (agent.knowledgeBase.length > 0) {
    const context = await getKnowledgeBaseContext(query, agentId);
    if (context) {
      knowledgeContext = `\n\nRelevant information from knowledge base:\n${context}`;
    }
  }

  return `You are ${agent.name}, an AI assistant for customer support.

Personality and Tone: ${agent.tone}

Instructions: ${agent.instructions}

Guidelines:
- Always maintain the specified tone and personality
- Use the knowledge base information when relevant to answer questions
- If the knowledge base doesn't contain relevant information, acknowledge this and provide general helpful responses
- Be concise but thorough
- Always be helpful and professional${knowledgeContext}`;
}
