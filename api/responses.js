// Super simple storage using JSONBin.io - NO SETUP REQUIRED!
const BIN_ID = '6778e0d9ad19ca34f8dffa5a'; // Public bin for defense poll
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const storageType = 'jsonbin';

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
      // Fetch all responses from JSONBin
      const response = await fetch(API_URL, {
        headers: {
          'X-Access-Key': '$2a$10$CwTycUXWue0Thq9StjUM0ue4Xb4Y6g1NWpWcqPO4p5kFqQz8pMz6a'
        }
      });
      
      if (!response.ok) {
        // If bin doesn't exist, return empty array
        return res.status(200).json({ responses: [], storageType });
      }
      
      const data = await response.json();
      return res.status(200).json({ responses: data.record || [], storageType });
      
    } else if (req.method === 'POST') {
      // Add a new response or update all responses
      const { response, responses: allResponses, action } = req.body;
      
      // First get current data
      const getResponse = await fetch(API_URL, {
        headers: {
          'X-Access-Key': '$2a$10$CwTycUXWue0Thq9StjUM0ue4Xb4Y6g1NWpWcqPO4p5kFqQz8pMz6a'
        }
      });
      
      let currentData = [];
      if (getResponse.ok) {
        const data = await getResponse.json();
        currentData = data.record || [];
      }
      
      let updatedData = currentData;
      
      if (action === 'reset') {
        // Reset all responses (admin action)
        updatedData = [];
      } else if (action === 'import') {
        // Import responses (admin action)
        updatedData = allResponses || [];
      } else if (response) {
        // Add a single new response
        const newResponse = {
          ...response,
          id: Date.now(),
          timestamp: new Date().toISOString()
        };
        updatedData = [...currentData, newResponse];
      }
      
      // Save back to JSONBin
      const saveResponse = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': '$2a$10$CwTycUXWue0Thq9StjUM0ue4Xb4Y6g1NWpWcqPO4p5kFqQz8pMz6a'
        },
        body: JSON.stringify(updatedData)
      });
      
      if (!saveResponse.ok) throw new Error('Failed to save');
      
      return res.status(200).json({ 
        success: true, 
        responses: updatedData,
        response: response ? updatedData[updatedData.length - 1] : undefined
      });
      
    } else if (req.method === 'DELETE') {
      // Delete a specific response
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Response ID required' });
      }
      
      // Get current data
      const getResponse = await fetch(API_URL, {
        headers: {
          'X-Access-Key': '$2a$10$CwTycUXWue0Thq9StjUM0ue4Xb4Y6g1NWpWcqPO4p5kFqQz8pMz6a'
        }
      });
      
      if (!getResponse.ok) throw new Error('Failed to fetch');
      
      const data = await getResponse.json();
      const currentData = data.record || [];
      const updatedData = currentData.filter(r => r.id !== id);
      
      // Save back
      const saveResponse = await fetch(API_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': '$2a$10$CwTycUXWue0Thq9StjUM0ue4Xb4Y6g1NWpWcqPO4p5kFqQz8pMz6a'
        },
        body: JSON.stringify(updatedData)
      });
      
      if (!saveResponse.ok) throw new Error('Failed to save');
      
      return res.status(200).json({ success: true, responses: updatedData });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}