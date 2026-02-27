import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from 'lucide-react';

interface TrajectoryChipProps {
  status: string;
  showLabel?: boolean;
  className?: string;
}

export function TrajectoryChip({ status, showLabel = true, className }: TrajectoryChipProps) {
  const getIcon = () => {
    switch (status) {
      case 'accelerating': return <TrendingUp className="h-3 w-3" />;
      case 'steady': return <Activity className="h-3 w-3" />;
      case 'drifting': return <TrendingDown className="h-3 w-3" />;
      case 'stalling': return <AlertTriangle className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  const getColorClass = () => {
    switch (status) {
      case 'accelerating': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'steady': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'drifting': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'stalling': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Badge variant="outline" className={`${getColorClass()} ${className || ''}`} data-testid={`badge-trajectory-${status}`}>
      <span className="mr-1">{getIcon()}</span>
      {showLabel && status}
    </Badge>
  );
}
