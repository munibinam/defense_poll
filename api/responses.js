import { kv } from '@vercel/kv';

const STORAGE_KEY = 'defense-poll-responses';

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
      const responses = await kv.get(STORAGE_KEY) || [];
      return res.status(200).json({ responses });
      
    } else if (req.method === 'POST') {
      // Add a new response or update all responses
      const { response, responses: allResponses, action } = req.body;
      
      if (action === 'reset') {
        // Reset all responses (admin action)
        await kv.set(STORAGE_KEY, []);
        return res.status(200).json({ success: true, responses: [] });
      }
      
      if (action === 'import') {
        // Import responses (admin action)
        await kv.set(STORAGE_KEY, allResponses || []);
        return res.status(200).json({ success: true, responses: allResponses || [] });
      }
      
      if (response) {
        // Add a single new response
        const currentResponses = await kv.get(STORAGE_KEY) || [];
        const newResponse = {
          ...response,
          id: Date.now(),
          timestamp: new Date().toISOString()
        };
        const updated = [...currentResponses, newResponse];
        await kv.set(STORAGE_KEY, updated);
        return res.status(200).json({ success: true, response: newResponse, responses: updated });
      }
      
      return res.status(400).json({ error: 'Invalid request' });
      
    } else if (req.method === 'DELETE') {
      // Delete a specific response
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Response ID required' });
      }
      
      const currentResponses = await kv.get(STORAGE_KEY) || [];
      const updated = currentResponses.filter(r => r.id !== id);
      await kv.set(STORAGE_KEY, updated);
      return res.status(200).json({ success: true, responses: updated });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    
    // If KV is not configured, fall back to in-memory storage for development
    if (error.message && error.message.includes('KV_REST_API_URL')) {
      return res.status(200).json({ 
        responses: [],
        warning: 'KV storage not configured. Using fallback mode.'
      });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}