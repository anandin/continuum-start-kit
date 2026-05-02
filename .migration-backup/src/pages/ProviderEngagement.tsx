import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function ProviderEngagement() {
  const { engagementId } = useParams<{ engagementId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (engagementId) {
      navigate(`/provider/client/${engagementId}`, { replace: true });
    } else {
      navigate('/dashboard', { replace: true });
    }
  }, [engagementId, navigate]);

  return null;
}
