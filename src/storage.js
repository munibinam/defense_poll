// Storage adapter that uses Vercel KV API

const API_URL = '/api/responses';

const storage = {
  async get(key) {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      
      if (data.warning) {
        console.warn('Storage warning:', data.warning);
        // Fall back to localStorage if KV is not configured
        const localData = localStorage.getItem(key);
        if (localData) {
          return { value: localData };
        }
      }
      
      // Return responses in the expected format
      return { value: JSON.stringify(data.responses || []) };
    } catch (error) {
      console.error('Storage get error:', error);
      // Fall back to localStorage on error
      const value = localStorage.getItem(key);
      if (value) {
        return { value };
      }
      return null;
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
          
          // Also clear localStorage as backup
          localStorage.setItem(key, value);
          return true;
        } else {
          // Import operation - check if it's from admin import
          const lastItem = data[data.length - 1];
          const isNewResponse = data.length === 1 || !lastItem.id;
          
          if (isNewResponse) {
            // This is adding a new response (normal user submission)
            // Extract the new response (last item)
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
      
      // Also save to localStorage as backup
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      // Fall back to localStorage on error
      localStorage.setItem(key, value);
      return true;
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

// Make storage available globally for compatibility
if (typeof window !== 'undefined') {
  window.storage = storage;
}

export default storage;