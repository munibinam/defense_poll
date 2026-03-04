// Storage adapter that uses Vercel KV API

const API_URL = '/api/responses';

const storage = {
  async get(key) {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch: ${response.status}`);
      }
      const data = await response.json();
      
      // Return responses in the expected format
      return { value: JSON.stringify(data.responses || []) };
    } catch (error) {
      console.error('Storage get error:', error);
      // Re-throw the error so the app can handle it properly
      throw error;
    }
  },

  async set(key, value) {
    try {
      const data = JSON.parse(value);
      
      // Check if this is a single response or bulk operation
      if (Array.isArray(data)) {
        // This is either a reset or import operation
        if (data.length === 0) {
          // Reset operation
          const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset' })
          });
          
          if (!response.ok) throw new Error('Failed to reset');
          return true;
        } else {
          // This could be either adding a new response OR importing data
          // We need to get the current responses first to determine which
          const currentDataResponse = await fetch(API_URL);
          const currentData = await currentDataResponse.json();
          const currentResponses = currentData.responses || [];
          
          if (data.length === currentResponses.length + 1) {
            // This is adding a single new response
            const newResponse = data[data.length - 1];
            const response = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ response: newResponse })
            });
            
            if (!response.ok) throw new Error('Failed to save');
          } else {
            // This is an import operation (admin)
            const response = await fetch(API_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'import', responses: data })
            });
            
            if (!response.ok) throw new Error('Failed to import');
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      throw error;
    }
  },

  async addResponse(response) {
    try {
      const apiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
      
      if (!apiResponse.ok) throw new Error('Failed to save response');
      const data = await apiResponse.json();
      return data.responses;
    } catch (error) {
      console.error('Add response error:', error);
      throw error;
    }
  },

  async deleteResponse(id) {
    try {
      const response = await fetch(API_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      
      if (!response.ok) throw new Error('Failed to delete');
      const data = await response.json();
      return data.responses;
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  }
};

export default storage;