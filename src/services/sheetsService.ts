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
      console.log(`[SHEETS_SERVICE] Fetching: ${API_URL}/${sheetName}`);
      const response = await fetch(`${API_URL}/${sheetName}`, {
        headers: getHeaders()
      });
      
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = `Server error (${response.status}): ${text}`;
        try {
          const json = JSON.parse(text);
          if (json.error) errorMessage = json.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        console.error(`Failed to parse JSON for ${sheetName}. Response text:`, text.substring(0, 200));
        throw new Error(`Server returned invalid data format (HTML instead of JSON). Status: ${response.status}`);
      }

      if (!Array.isArray(data)) {
        throw new Error('Expected an array from the server');
      }
      return data;
    } catch (error) {
      console.error(`Fetch error for ${sheetName}:`, error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(`Gagal terhubung ke server. Pastikan server backend sedang berjalan dan URL API benar.`);
      }
      throw error;
    }
  },

  async getBatch(): Promise<Record<string, SheetData[]>> {
    try {
      console.log(`[SHEETS_SERVICE] Fetching batch data`);
      const response = await fetch(`${API_URL}/batch`, {
        headers: getHeaders()
      });
      
      if (!response.ok) {
        const text = await response.text();
        let errorMessage = `Server error (${response.status}): ${text}`;
        try {
          const json = JSON.parse(text);
          if (json.error) errorMessage = json.error;
        } catch (e) {}
        throw new Error(errorMessage);
      }
      
      let data;
      try {
        data = await response.json();
      } catch (e) {
        const text = await response.text();
        console.error(`Failed to parse JSON for batch. Response text:`, text.substring(0, 200));
        throw new Error(`Server returned invalid data format (HTML instead of JSON). Status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`Fetch error for batch:`, error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(`Gagal terhubung ke server. Pastikan server backend sedang berjalan dan URL API benar.`);
      }
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
    try {
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
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(`Gagal terhubung ke server. Pastikan server backend sedang berjalan.`);
      }
      throw error;
    }
  },

  async register(data: any): Promise<void> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error(`Gagal terhubung ke server. Pastikan server backend sedang berjalan.`);
      }
      throw error;
    }
  },
};
