import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ManualTestRunner() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  return null;
}
