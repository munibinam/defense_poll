import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Simple in-memory storage for Vercel serverless
let responseData = [];
let initialized = false;

// Try to load data from a temporary file (this will reset on each deploy, but works for testing)
function initStorage() {
  if (initialized) return;
  
  try {
    // Try to read from environment variable or use empty array
    const dataStr = process.env.POLL_DATA || '[]';
    responseData = JSON.parse(dataStr);
  } catch (error) {
    responseData = [];
  }
  
  initialized = true;
}

// Simple storage interface
const storage = {
  get: () => {
    initStorage();
    return responseData;
  },
  
  set: (data) => {
    initStorage();
    responseData = data;
    return true;
  }
};

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
      // Fetch all responses
      const responses = storage.get() || [];
      return res.status(200).json({ responses, storageType, note: 'Using in-memory storage - data resets on deployment' });
      
    } else if (req.method === 'POST') {
      // Add a new response or update all responses
      const { response, responses: allResponses, action } = req.body;
      
      if (action === 'reset') {
        // Reset all responses (admin action)
        storage.set([]);
        return res.status(200).json({ success: true, responses: [] });
      }
      
      if (action === 'import') {
        // Import responses (admin action)
        storage.set(allResponses || []);
        return res.status(200).json({ success: true, responses: allResponses || [] });
      }
      
      if (response) {
        // Add a single new response
        const currentResponses = storage.get() || [];
        const newResponse = {
          ...response,
          id: Date.now(),
          timestamp: new Date().toISOString()
        };
        const updated = [...currentResponses, newResponse];
        storage.set(updated);
        return res.status(200).json({ success: true, response: newResponse, responses: updated });
      }
      
      return res.status(400).json({ error: 'Invalid request' });
      
    } else if (req.method === 'DELETE') {
      // Delete a specific response
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Response ID required' });
      }
      
      const currentResponses = storage.get() || [];
      const updated = currentResponses.filter(r => r.id !== id);
      storage.set(updated);
      return res.status(200).json({ success: true, responses: updated });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}