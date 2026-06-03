import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

// Admin felhasználók listája, akiktől nem lehet elvenni a jogot
const PERMANENT_ADMINS = ['pal.konecsny@outlook.hu', 'admin@szemesipekseg.hu'];

type Role = 'admin' | 'baker' | 'salesperson' | 'driver' | 'partner' | null;

interface RoleContextType {
  role: Role;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      getUserRole();
    } else {
      setRole(null);
      setLoading(false);
    }
  }, [user]);

  const getUserRole = async () => {
    try {
      setLoading(true);
      
      // First check user metadata
      if (user?.user_metadata?.role) {
        setRole(user.user_metadata.role as Role);
        return;
      }
      
      // Then check profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();
      
      if (error) {
        console.error('Error fetching role:', error);
        setRole(null);
      } else if (data) {
        setRole(data.role as Role);
      } else {
        setRole(null);
      }
    } catch (error) {
      console.error('Error getting user role:', error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshRole = async () => {
    await getUserRole();
  };

  const value = {
    role,
    loading,
    refreshRole
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}