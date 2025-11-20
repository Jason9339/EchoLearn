import { isOpenAIConfigured } from '@/lib/openai';

/**
 * GET /api/system/openai-status
 * Check if OpenAI API is configured
 * Returns JSON: { configured: boolean }
 */
export async function GET(): Promise<Response> {
  return Response.json({
    configured: isOpenAIConfigured(),
  });
}
