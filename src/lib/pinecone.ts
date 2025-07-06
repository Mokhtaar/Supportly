import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Get the main index (without namespace in constructor)
function getIndex() {
  return pinecone.Index('supportgenius-knowledge');
}

export interface QueryResult {
  text: string;
  score: number;
  source: string;
}

const RELEVANCE_THRESHOLD = 0.3;

/**
 * Retry logic with exponential backoff for Pinecone operations
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 1000
): Promise<T> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("rate limit exceeded") && retries < maxRetries - 1) {
        const waitTime = Math.pow(2, retries) * baseDelay;
        console.log(`Rate limit hit, waiting ${waitTime / 1000} seconds before retry ${retries + 1}/${maxRetries}...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        retries++;
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Operation failed after ${maxRetries} retries`);
}

async function getBatchedEmbeddings(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) {
    return [];
  }
  
  // Filter out empty inputs
  const validInputs = inputs.filter(input => input && input.trim().length > 0);
  
  if (validInputs.length === 0) {
    throw new Error('No valid inputs provided');
  }
  
  // Batch all inputs in a single request for better performance
  // Note: OpenAI allows up to 300K tokens total across all inputs
  const { data } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: validInputs,
    dimensions: 1536,
    encoding_format: 'float',
  });
  
  return data.map(item => item.embedding);
}



//search knowledge base
export async function queryPinecone(
  query: string,
  agentId: string,
  topK = 3
): Promise<QueryResult[]> {
  try {
    console.log('queryPinecone called with:', { query, agentId, topK });

    const [embedding] = await getBatchedEmbeddings([query]);
    console.log('Generated embedding length:', embedding.length);

    // Use namespace in the query operation
    const index = getIndex();
    const searchResponse = await index.namespace(agentId).query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    console.log('Pinecone search response:', {
      namespace: agentId,
      matches: searchResponse.matches.length,
      scores: searchResponse.matches.map(m => m.score),
      firstMatch: searchResponse.matches[0]?.metadata,
    });

    const results = searchResponse.matches
      .filter(match => match.score && match.score > RELEVANCE_THRESHOLD)
      .map(match => ({
        text: match.metadata?.content as string || '',
        score: match.score || 0,
        source: match.metadata?.source as string || 'unknown',
      }));

    console.log('Filtered results:', results.length, `results with score > ${RELEVANCE_THRESHOLD}`);
    return results;
  } catch (error) {
    console.error('Pinecone query error:', error);
    return [];
  }
}

export async function storeEmbeddings(
  chunks: string[],
  embeddings: number[][],
  knowledgeBaseId: string,
  agentId?: string,
  fileName = 'unknown'
): Promise<void> {
  try {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings arrays must have the same length');
    }

    if (!agentId) {
      throw new Error('Agent ID is required for namespace-based storage');
    }

    const vectors = chunks.map((chunk, index) => {
      const metadata: Record<string, string | number> = {
        knowledge_base_id: knowledgeBaseId,
        content: chunk,
        source: fileName,
        chunk_index: index,
      };

      return {
        id: `${knowledgeBaseId}:${index}`, // Simplified ID structure like namespace-notes
        values: embeddings[index],
        metadata,
      };
    });

    // Batch processing for better performance
    const index = getIndex();
    const namespace = index.namespace(agentId);
    const batchSize = 200;
    
    console.log(`Storing ${vectors.length} embeddings in batches of ${batchSize} in namespace: ${agentId}`);
    
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      
      await retryWithBackoff(async () => {
        await namespace.upsert(batch);
      });
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)} completed`);
    }
    
    console.log(`Successfully stored ${vectors.length} embeddings in namespace: ${agentId}`);
  } catch (error) {
    console.error('Pinecone storage error:', error);
    throw error;
  }
}

/**
 * List document chunks using listPaginated (efficient approach from namespace-notes)
 */
async function listDocumentChunks(
  documentIdPrefix: string,
  agentId: string,
  limit = 100,
  paginationToken?: string
): Promise<{ chunks: { id: string }[]; paginationToken?: string }> {
  try {
    const index = getIndex();
    const namespace = index.namespace(agentId);
    
    const listResult = await namespace.listPaginated({
      prefix: documentIdPrefix,
      limit: limit,
      paginationToken: paginationToken,
    });

    const chunks = listResult.vectors?.map((vector) => ({ id: vector.id || "" })) || [];
    return { chunks, paginationToken: listResult.pagination?.next };
  } catch (error) {
    console.error(`Failed to list document chunks for prefix ${documentIdPrefix}:`, error);
    throw error;
  }
}

export async function deleteKnowledgeBaseFromPinecone(
  knowledgeBaseId: string,
  agentId: string
): Promise<void> {
  try {
    const index = getIndex();
    const namespace = index.namespace(agentId);
    console.log(`Deleting knowledge base ${knowledgeBaseId} from namespace: ${agentId}`);
    
    // Use efficient listPaginated approach
    const documentPrefix = `${knowledgeBaseId}:`; // Based on our simplified ID structure
    const pageSize = 100;
    let paginationToken;
    let deleteCount = 0;

    do {
      try {
        const listResult = await listDocumentChunks(
          documentPrefix,
          agentId,
          pageSize,
          paginationToken
        );

        if (listResult.chunks.length === 0) {
          break;
        }

        const chunkIds = listResult.chunks.map((chunk) => chunk.id);
        console.log(`Deleting ${chunkIds.length} chunks with prefix ${documentPrefix}`);
        
        await retryWithBackoff(async () => {
          await namespace.deleteMany(chunkIds);
        });
        
        deleteCount += chunkIds.length;

        if (!listResult.paginationToken) {
          break;
        }
        paginationToken = listResult.paginationToken;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("No IDs provided for delete request")) {
          console.warn("Skipping Pinecone deletion due to missing IDs:", error);
          break;
        } else {
          throw error;
        }
      }
    } while (paginationToken !== undefined);

    console.log(`Successfully deleted ${deleteCount} chunks for knowledge base ${knowledgeBaseId} from namespace: ${agentId}`);
  } catch (error) {
    console.error('Pinecone deletion error:', error);
    throw error;
  }
}

// New utility functions for namespace management

/**
 * Delete an entire agent's namespace (useful when deleting an agent)
 */
export async function deleteAgentNamespace(agentId: string): Promise<void> {
  try {
    const index = getIndex();
    
    await retryWithBackoff(async () => {
      await index.namespace(agentId).deleteAll();
    });
    
    console.log(`Successfully deleted entire namespace: ${agentId}`);
  } catch (error) {
    console.error('Error deleting agent namespace:', error);
    throw error;
  }
}

/**
 * Get stats for an agent's namespace
 */
export async function getNamespaceStats(agentId: string): Promise<{ vectorCount: number }> {
  try {
    const index = getIndex();
    const stats = await index.describeIndexStats();
    
    // Return stats for the specific namespace
    const namespaceStats = stats.namespaces?.[agentId];
    return { 
      vectorCount: namespaceStats?.recordCount || 0 
    };
  } catch (error) {
    console.error('Error getting namespace stats:', error);
    return { vectorCount: 0 };
  }
} 