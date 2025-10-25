import { Anchor } from './ui';

export interface ServiceInfoData {
  name: string;
  description: string;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  url: string;
  accountSetupInstructions?: string[];
}

interface ServiceInfoProps {
  service: ServiceInfoData;
  isRunning?: boolean;
  showAccountInstructions?: boolean;
}

const badgeColorMap: Record<string, string> = {
  'blue': 'bg-blue-900/30 text-blue-200',
  'green': 'bg-green-900/30 text-green-200',
  'orange': 'bg-orange-900/30 text-orange-200',
  'purple': 'bg-purple-900/30 text-purple-200',
};

export function ServiceInfo({ service, isRunning = true, showAccountInstructions = false }: ServiceInfoProps) {
  const badgeClass = badgeColorMap[service.badgeColor] || 'bg-neutral-700 text-neutral-300';
  
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0">{service.icon}</div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-lg">{service.name}</h3>
          <span className={`px-2 py-1 rounded text-xs font-medium ${badgeClass}`}>
            {service.badge}
          </span>
          {isRunning && (
            <Anchor
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm inline-flex items-center gap-1"
            >
              Open {service.name}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Anchor>
          )}
        </div>
        <p className={`text-sm text-neutral-400 ${showAccountInstructions ? 'mb-4' : ''}`}>
          {service.description}
        </p>
        {showAccountInstructions && service.accountSetupInstructions && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-200">
              📝 Account Setup Instructions:
            </p>
            {service.accountSetupInstructions.map((instruction, index) => (
              <p key={index} className="text-sm text-neutral-400 ml-4">
                {index + 1}. {instruction}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}