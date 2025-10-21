import { Group, Text, Badge, Anchor, Stack } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';

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

export function ServiceInfo({ service, isRunning = true, showAccountInstructions = false }: ServiceInfoProps) {
  return (
    <Group align="flex-start" gap="md">
      {service.icon}
      <div style={{ flex: 1 }}>
        <Group gap="sm" mb="xs">
          <Text fw={600} size="lg">{service.name}</Text>
          <Badge color={service.badgeColor} variant="light">{service.badge}</Badge>
          {isRunning && (
            <Anchor
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
            >
              Open {service.name}
              <IconExternalLink size="0.8rem" style={{ marginLeft: '4px' }} />
            </Anchor>
          )}
        </Group>
        <Text size="sm" c="dimmed" mb={showAccountInstructions ? "md" : undefined}>
          {service.description}
        </Text>
        {showAccountInstructions && service.accountSetupInstructions && (
          <Stack gap="xs">
            <Text size="sm" fw={500} c="blue">
              📝 Account Setup Instructions:
            </Text>
            {service.accountSetupInstructions.map((instruction, index) => (
              <Text key={index} size="sm" c="dimmed" ml="md">
                {index + 1}. {instruction}
              </Text>
            ))}
          </Stack>
        )}
      </div>
    </Group>
  );
}