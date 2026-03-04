import { Redis } from '@upstash/redis';

const STORAGE_KEY = 'defense-poll-responses';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    if (req.method === 'GET') {
      // Fetch all responses
      const responses = await redis.get(STORAGE_KEY) || [];
      return res.status(200).json({ responses });
      
    } else if (req.method === 'POST') {
      // Add a new response or update all responses
      const { response, responses: allResponses, action } = req.body;
      
      if (action === 'reset') {
        // Reset all responses (admin action)
        await redis.set(STORAGE_KEY, []);
        return res.status(200).json({ success: true, responses: [] });
      }
      
      if (action === 'import') {
        // Import responses (admin action)
        await redis.set(STORAGE_KEY, allResponses || []);
        return res.status(200).json({ success: true, responses: allResponses || [] });
      }
      
      if (response) {
        // Add a single new response
        const currentResponses = await redis.get(STORAGE_KEY) || [];
        const newResponse = {
          ...response,
          id: Date.now(),
          timestamp: new Date().toISOString()
        };
        const updated = [...currentResponses, newResponse];
        await redis.set(STORAGE_KEY, updated);
        return res.status(200).json({ success: true, response: newResponse, responses: updated });
      }
      
      return res.status(400).json({ error: 'Invalid request' });
      
    } else if (req.method === 'DELETE') {
      // Delete a specific response
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Response ID required' });
      }
      
      const currentResponses = await redis.get(STORAGE_KEY) || [];
      const updated = currentResponses.filter(r => r.id !== id);
      await redis.set(STORAGE_KEY, updated);
      return res.status(200).json({ success: true, responses: updated });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    
    // If Redis is not configured, return a clear error message
    if (error.message && (error.message.includes('UPSTASH_REDIS_REST_URL') || error.message.includes('unauthorized'))) {
      return res.status(500).json({ 
        error: 'Database not configured. Please set up Upstash Redis integration.',
        setup: 'Go to Vercel Marketplace → Search "Upstash Redis" → Add to project'
      });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}