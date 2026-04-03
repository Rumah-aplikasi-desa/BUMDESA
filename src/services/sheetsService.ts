export interface SheetData {
  [key: string]: any;
}

const API_URL = '/api/sheets';

const getHeaders = () => {
  const token = sessionStorage.getItem('bumdesa_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const sheetsService = {
  async get(sheetName: string): Promise<SheetData[]> {
    try {
      const response = await fetch(`${API_URL}/${sheetName}`, {
        headers: getHeaders()
      });
      const text = await response.text();
      if (!response.ok) throw new Error(text);
      
      try {
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && 'error' in data) {
          throw new Error(data.error);
        }
        if (!Array.isArray(data)) {
          throw new Error('Expected an array from the server');
        }
        return data;
      } catch (e: any) {
        throw new Error(e.message || `Invalid JSON response: ${text.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error(`Fetch error for ${sheetName}:`, error);
      throw error;
    }
  },

  async create(sheetName: string, data: SheetData): Promise<void> {
    const response = await fetch(`${API_URL}/${sheetName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
  },
 
  async batchCreate(sheetName: string, dataArray: SheetData[]): Promise<void> {
    const response = await fetch(`${API_URL}/${sheetName}/batch`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(dataArray)
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async update(sheetName: string, id: string, data: SheetData): Promise<void> {
    const response = await fetch(`${API_URL}/${sheetName}/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async delete(sheetName: string, id: string): Promise<void> {
    const response = await fetch(`${API_URL}/${sheetName}/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async clear(sheetName: string): Promise<void> {
    const response = await fetch(`${API_URL}/${sheetName}/clear`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async batchDelete(sheetName: string, ids: string[]): Promise<void> {
    const response = await fetch(`${API_URL}/${sheetName}/batch-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(ids)
    });
    if (!response.ok) throw new Error(await response.text());
  },

  async login(credentials: any): Promise<any> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }
    return response.json();
  },

  async register(data: any): Promise<void> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }
  },
};
