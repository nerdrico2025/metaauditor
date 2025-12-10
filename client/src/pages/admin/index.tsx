import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';

export default function SuperAdmin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (user?.role === 'super_admin') {
      setLocation('/admin/dashboard');
    }
  }, [user, setLocation]);

  return null;
}
