import { supabase } from '@/lib/supabase';
import type { UserRole } from '@/types';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Get auth token for API requests
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

export const adminUserService = {
  // Create a new user (admin only)
  async createUser(userData: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
  }) {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }

    return response.json();
  },

  // Delete a user (admin only)
  async deleteUser(userId: string) {
    const token = await getAuthToken();

    const response = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user');
    }

    return response.json();
  }
};
