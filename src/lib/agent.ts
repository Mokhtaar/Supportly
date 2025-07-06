import { Agent, tool } from '@openai/agents';
import { queryPinecone } from './pinecone';

export interface ChatContext {
  sessionId: string;
  userId: string;
  chatHistory: Array<{ role: string; content: string }>;
  agentId: string;
}

export function createSupportGeniusAgent(agentConfig: {
  name: string;
  instructions: string;
}) {
  return new Agent<ChatContext>({
    name: agentConfig.name,
    instructions: agentConfig.instructions,
    tools: [
      tool({
        name: 'searchKnowledgeBase',
        description: 'Searches the knowledge base for relevant information.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The user question' }
          },
          required: ['query'],
          additionalProperties: false
        },
        execute: async (input: unknown, runContext) => {
          const { query } = input as { query: string };
          const agentId = runContext!.context.agentId;
          if (!agentId) throw new Error('agentId missing from context');
          const results = await queryPinecone(query, agentId);
          if (!results.length) return 'No relevant information found.';
          return results.map(r => `Source: ${r.source}\nScore: ${r.score}\n${r.text}`).join('\n---\n');
        }
      })
    ],
    modelSettings: { toolChoice: 'required' },
  });
} 


