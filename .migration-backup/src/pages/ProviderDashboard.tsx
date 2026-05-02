import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProviderDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return null;
}
