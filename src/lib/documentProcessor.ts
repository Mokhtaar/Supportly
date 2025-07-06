import pdf from 'pdf-parse';
import { promises as fs } from 'fs';
import { storeEmbeddings } from './pinecone';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Splits a given text into chunks of 1 to many paragraphs.
 * 
 * @param text - The input text to be chunked.
 * @param maxChunkSize - The maximum size (in characters) allowed for each chunk. Default is 1500.
 * @param minChunkSize - The minimum size (in characters) required for each chunk. Default is 500.
 * @returns An array of chunked text, where each chunk contains 1 or multiple "paragraphs"
 */
function chunkTextByMultiParagraphs(
  text: string,
  maxChunkSize = 1500,
  minChunkSize = 500
): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  let startIndex = 0;
  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    if (endIndex >= text.length) {
      endIndex = text.length;
    } else {
      // Just using this to find the nearest paragraph boundary
      const paragraphBoundary = text.indexOf("\n\n", endIndex);
      if (paragraphBoundary !== -1) {
        endIndex = paragraphBoundary;
      }
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk.length >= minChunkSize) {
      chunks.push(chunk);
      currentChunk = "";
    } else {
      currentChunk += chunk + "\n\n";
    }

    startIndex = endIndex + 1;
  }

  if (currentChunk.length >= minChunkSize) {
    chunks.push(currentChunk.trim());
  } else if (chunks.length > 0) {
    chunks[chunks.length - 1] += "\n\n" + currentChunk.trim();
  } else {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export async function extractTextFromFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  
  switch (file.type) {
    case 'application/pdf':
      const pdfData = await pdf(Buffer.from(buffer));
      return pdfData.text;
    
    case 'text/plain':
    case 'text/csv':
      return new TextDecoder().decode(buffer);
    
    default:
      throw new Error(`Unsupported file type: ${file.type}`);
  }
}

export async function extractTextFromFilePath(filePath: string, fileType: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  
  switch (fileType) {
    case 'application/pdf':
      const pdfData = await pdf(buffer);
      return pdfData.text;
    
    case 'text/plain':
    case 'text/markdown':
      return buffer.toString('utf-8');
    
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

export async function chunkText(text: string): Promise<string[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  // Use Pinecone's paragraph-based chunking approach
  const chunks = chunkTextByMultiParagraphs(text);
  
  // Filter out very small chunks that might not be meaningful
  return chunks.filter(chunk => chunk.trim().length > 50);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      dimensions: 1536,
      encoding_format: 'float',
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw new Error('Failed to generate embeddings');
  }
}

export async function processDocument(
  filePath: string, 
  fileType: string, 
  knowledgeBaseId?: string,
  agentId?: string,
  fileName?: string
): Promise<string[]> {
  try {
    // Extract text from the document
    const text = await extractTextFromFilePath(filePath, fileType);
    console.log("text", text);
    
    if (!text.trim()) {
      throw new Error('No text content found in the document');
    }

    // Split text into chunks using Pinecone's approach
    const chunks = await chunkText(text);
    
    if (chunks.length === 0) {
      throw new Error('No valid chunks generated from the document');
    }

    console.log(`Generated ${chunks.length} chunks from document:`, chunks.map(c => `${c.length} chars`));

    // Generate embeddings for chunks
    const embeddings = await generateEmbeddings(chunks);

    // Store embeddings in Pinecone if knowledgeBaseId is provided
    if (knowledgeBaseId) {
      await storeEmbeddings(chunks, embeddings, knowledgeBaseId, agentId, fileName);
    }

    return chunks;
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['application/pdf', 'text/plain', 'text/csv'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Unsupported file type. Only PDF, TXT, and CSV files are allowed.',
    };
  }

  if (file.size > maxFileSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 10MB.',
    };
  }

  return { valid: true };
} 