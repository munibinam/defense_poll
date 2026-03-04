// GitHub as database - persistent and free!
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set this in Vercel environment variables
const GITHUB_OWNER = 'munibinam';
const GITHUB_REPO = 'defense-poll';
const DATA_FILE = 'data/responses.json';
const storageType = 'github';

// Helper to get data from GitHub
async function getDataFromGitHub() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!response.ok) {
      // File doesn't exist yet
      return { data: [], sha: null };
    }
    
    const file = await response.json();
    const content = Buffer.from(file.content, 'base64').toString('utf-8');
    return { data: JSON.parse(content), sha: file.sha };
  } catch (error) {
    console.log('Error getting data:', error);
    return { data: [], sha: null };
  }
}

// Helper to save data to GitHub
async function saveDataToGitHub(data, sha) {
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    const body = {
      message: `Update responses - ${new Date().toISOString()}`,
      content: content,
      branch: 'main'
    };
    
    if (sha) {
      body.sha = sha;
    }
    
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_FILE}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
}

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
      // Get current responses from GitHub
      const { data } = await getDataFromGitHub();
      return res.status(200).json({ responses: data, storageType });
      
    } else if (req.method === 'POST') {
      // Add a new response or update all responses
      const { response, responses: allResponses, action } = req.body;
      
      // Get current data and SHA
      const { data: currentData, sha } = await getDataFromGitHub();
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
      
      // Save to GitHub
      const saved = await saveDataToGitHub(updatedData, sha);
      
      if (!saved) {
        return res.status(500).json({ error: 'Failed to save to GitHub' });
      }
      
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
      
      // Get current data and SHA
      const { data: currentData, sha } = await getDataFromGitHub();
      const updatedData = currentData.filter(r => r.id !== id);
      
      // Save to GitHub
      const saved = await saveDataToGitHub(updatedData, sha);
      
      if (!saved) {
        return res.status(500).json({ error: 'Failed to save to GitHub' });
      }
      
      return res.status(200).json({ success: true, responses: updatedData });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}