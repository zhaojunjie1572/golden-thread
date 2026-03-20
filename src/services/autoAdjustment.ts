import { ProtocolModel } from '../types/protocol';

export function autoDowngrade(protocol: ProtocolModel): ProtocolModel {
  if (protocol.consecutiveFailures < 3) {
    return protocol;
  }

  let adjusted = { ...protocol };

  adjusted.minimumAction = simplifyAction(adjusted.minimumAction);

  if (adjusted.maxDuration > 5) {
    adjusted.maxDuration = Math.max(5, Math.floor(adjusted.maxDuration / 2));
  }

  adjusted.frequency = adjustFrequency(adjusted.frequency, true);

  console.log('🔽 自动降级:', adjusted.principle);
  return adjusted;
}

export function autoUpgrade(protocol: ProtocolModel): ProtocolModel {
  if (protocol.consecutiveSuccesses < 5) {
    return protocol;
  }

  let adjusted = { ...protocol };

  adjusted.maxDuration = Math.min(60, adjusted.maxDuration + 10);

  adjusted.frequency = adjustFrequency(adjusted.frequency, false);

  console.log('🔼 自动升级:', adjusted.principle);
  return adjusted;
}

function simplifyAction(action: string): string {
  return action
    .replace(/5页/g, '1页')
    .replace(/10分钟/g, '2分钟')
    .replace(/30分钟/g, '5分钟')
    .replace(/20个/g, '5个')
    .replace(/10个/g, '3个');
}

function adjustFrequency(frequency: string, downgrade: boolean): string {
  const frequencies = ['daily', 'weekly', 'monthly'];
  const index = frequencies.indexOf(frequency);

  if (index === -1) return frequency;

  if (downgrade && index < frequencies.length - 1) {
    return frequencies[index + 1];
  } else if (!downgrade && index > 0) {
    return frequencies[index - 1];
  }

  return frequency;
}

export function checkAndAdjust(protocol: ProtocolModel): ProtocolModel {
  let adjusted = { ...protocol };

  if (shouldAutoDowngrade(protocol)) {
    adjusted = autoDowngrade(adjusted);
  } else if (shouldAutoUpgrade(protocol)) {
    adjusted = autoUpgrade(adjusted);
  }

  return adjusted;
}

function shouldAutoDowngrade(protocol: ProtocolModel): boolean {
  return protocol.consecutiveFailures >= 3;
}

function shouldAutoUpgrade(protocol: ProtocolModel): boolean {
  return protocol.consecutiveSuccesses >= 5;
}
