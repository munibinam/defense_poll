import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://sywxtfwqnlrpjhzoqoqr.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'sb_publishable_qYoU4yjxo_GG_YSOsjKRrA_RItsU8MN'
);

const TABLE_NAME = 'responses';
const storageType = 'supabase';

// Initialize the table if it doesn't exist
async function initTable() {
  try {
    // Check if table exists by trying to query it
    const { error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .limit(1);
    
    if (error && error.code === '42P01') {
      // Table doesn't exist, create it via raw SQL
      const { error: createError } = await supabase.rpc('create_responses_table', {
        sql: `
          CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
            id BIGSERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            slots TEXT[] NOT NULL,
            mode TEXT NOT NULL,
            timestamp TIMESTAMPTZ DEFAULT NOW()
          )
        `
      });
      
      if (createError) {
        console.log('Table might already exist or needs manual creation');
      }
    }
  } catch (error) {
    console.log('Table initialization:', error);
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
    // Initialize table on first use
    await initTable();
    
    if (req.method === 'GET') {
      // Fetch all responses from Supabase
      const { data: responses, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('timestamp', { ascending: true });
      
      if (error) throw error;
      return res.status(200).json({ responses: responses || [], storageType });
      
    } else if (req.method === 'POST') {
      // Add a new response or update all responses
      const { response, responses: allResponses, action } = req.body;
      
      if (action === 'reset') {
        // Reset all responses (admin action)
        const { error } = await supabase
          .from(TABLE_NAME)
          .delete()
          .neq('id', 0); // Delete all (neq trick for Supabase)
        
        if (error) throw error;
        return res.status(200).json({ success: true, responses: [] });
      }
      
      if (action === 'import') {
        // Import responses (admin action)
        // First clear existing
        await supabase.from(TABLE_NAME).delete().neq('id', 0);
        
        // Then insert all
        if (allResponses && allResponses.length > 0) {
          const { error } = await supabase
            .from(TABLE_NAME)
            .insert(allResponses.map(r => ({
              name: r.name,
              slots: r.slots,
              mode: r.mode,
              timestamp: r.timestamp || new Date().toISOString()
            })));
          
          if (error) throw error;
        }
        
        return res.status(200).json({ success: true, responses: allResponses || [] });
      }
      
      if (response) {
        // Add a single new response
        const { data: newResponse, error } = await supabase
          .from(TABLE_NAME)
          .insert({
            name: response.name,
            slots: response.slots,
            mode: response.mode
          })
          .select()
          .single();
        
        if (error) throw error;
        
        // Fetch all responses to return
        const { data: allResponses } = await supabase
          .from(TABLE_NAME)
          .select('*')
          .order('timestamp', { ascending: true });
        
        return res.status(200).json({ success: true, response: newResponse, responses: allResponses || [] });
      }
      
      return res.status(400).json({ error: 'Invalid request' });
      
    } else if (req.method === 'DELETE') {
      // Delete a specific response
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Response ID required' });
      }
      
      const { error } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Fetch remaining responses
      const { data: responses } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('timestamp', { ascending: true });
      
      return res.status(200).json({ success: true, responses: responses || [] });
      
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}