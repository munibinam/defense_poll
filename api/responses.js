// In-memory storage that persists during the function's lifecycle
// Will reset on new deployments, but works for demo purposes
let globalResponses = [];
const storageType = 'memory';

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
      // Return current responses
      return res.status(200).json({ responses: globalResponses, storageType });
      
    } else if (req.method === 'POST') {
      // Add a new response or update all responses
      const { response, responses: allResponses, action } = req.body;
      
      if (action === 'reset') {
        // Reset all responses (admin action)
        globalResponses = [];
        return res.status(200).json({ success: true, responses: [] });
      }
      
      if (action === 'import') {
        // Import responses (admin action)
        globalResponses = allResponses || [];
        return res.status(200).json({ success: true, responses: globalResponses });
      }
      
      if (response) {
        // Add a single new response
        const newResponse = {
          ...response,
          id: Date.now(),
          timestamp: new Date().toISOString()
        };
        globalResponses = [...globalResponses, newResponse];
        return res.status(200).json({ 
          success: true, 
          responses: globalResponses,
          response: newResponse
        });
      }
      
      return res.status(400).json({ error: 'Invalid request' });
      
    } else if (req.method === 'DELETE') {
      // Delete a specific response
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Response ID required' });
      }
      
      globalResponses = globalResponses.filter(r => r.id !== id);
      return res.status(200).json({ success: true, responses: globalResponses });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}