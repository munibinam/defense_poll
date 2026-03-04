// Storage adapter that works with localStorage for now
// Can be replaced with Vercel KV or other backend storage later

const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value) {
        return { value };
      }
      return null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      throw error;
    }
  }
};

// Make storage available globally for compatibility
if (typeof window !== 'undefined') {
  window.storage = storage;
}

export default storage;