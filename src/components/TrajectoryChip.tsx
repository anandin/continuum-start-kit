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
      case 'accelerating': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'steady': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'drifting': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'stalling': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <Badge className={`${getColorClass()} ${className || ''}`}>
      <span className="mr-1">{getIcon()}</span>
      {showLabel && status}
    </Badge>
  );
}
