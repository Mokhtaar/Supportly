import { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import { getConversationHistory } from "@/lib/context";
import { canUserAccessAgent } from "@/lib/client";
import { findOrCreateConversation, addMessageToConversation } from "@/lib/conversation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createSupportGeniusAgent, ChatContext } from "@/lib/agent";
import { run, user, AgentInputItem, assistant } from "@openai/agents";

// Fix the linter warning by using the imported functions
const userMessage = user;
const assistantMessage = assistant;

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
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  agentId: z.string().uuid(),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { messages, agentId, sessionId } = ChatRequestSchema.parse(body);

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return new Response("Last message must be from user", { status: 400 });
    }

    // Check if user can access this agent
    const canAccess = await canUserAccessAgent(user.id, agentId);
    if (!canAccess) {
      return new Response("Agent not found or access denied", { status: 404 });
    }

    // Get agent and verify ownership
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        knowledgeBase: {
          where: { processingStatus: "COMPLETED" },
        },
      },
    });

    if (!agent) {
      return new Response("Agent not found", { status: 404 });
    }

    // Use consistent sessionId from frontend
    const actualSessionId = sessionId || `fallback-${Date.now()}`;

    // Find or create conversation
    const conversation = await findOrCreateConversation({
      agentId,
      sessionId: actualSessionId,
      userId: user.id,
      channel: "WEB",
    });

    // Get conversation history
    const conversationHistory = await getConversationHistory(
      agentId,
      actualSessionId
    );

    // Create the agent dynamically from DB config
    const supportAgent = createSupportGeniusAgent({
      name: agent.name,
      instructions: agent.instructions,
    }); 

    // Build conversation thread INCLUDING current message (don't save user message yet)
    const conversationThread: AgentInputItem[] = [
      ...conversationHistory.map((msg: { role: string; content: string }) => 
        msg.role === 'user' 
        ? userMessage(msg.content)
        : assistantMessage(msg.content)
      ),
      userMessage(lastMessage.content) // Add current message directly
    ];
    
    // Prepare context for the agent
    const context: ChatContext = {
      sessionId: actualSessionId,
      userId: user.id,
      chatHistory: conversationHistory,
      agentId,
    };
    
    let streamResult;
    try {
      streamResult = await run(
        supportAgent, //agent
        conversationThread, // full conversation history
        { stream: true, context }, // options
      );
    } catch (err) {
      console.error("Error during agent stream:", err);
      
      // Fallback: Save user message if agent processing fails
      try {
        await addMessageToConversation({
          conversationId: conversation.id,
          role: "USER",
          content: lastMessage.content,
        });
      } catch (saveError) {
        console.error("Error saving user message in fallback:", saveError);
      }
      
      return new Response("Agent stream error", { status: 500 });
    }

    // Get the text stream for the client
    const textStream = streamResult.toTextStream({ compatibleWithNodeStreams: true });

    // Save both messages in background (don't await to avoid blocking response)
    Promise.all([
      // Save user message
      addMessageToConversation({
        conversationId: conversation.id,
        role: "USER",
        content: lastMessage.content,
      }),
      // Save assistant response after completion
      streamResult.completed.then(() => 
        addMessageToConversation({
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: streamResult.finalOutput || "",
        })
      )
    ]).then(() => {
      console.log("Both messages saved successfully");
    }).catch(error => {
      console.error("Error saving messages:", error);
    });

    // Return the streaming response immediately
    return new Response(textStream as unknown as ReadableStream, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    if (error instanceof z.ZodError) {
      return new Response("Invalid request format", { status: 400 });
    }
    return new Response("Internal server error", { status: 500 });
  }
}
