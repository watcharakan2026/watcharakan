export interface AgentOption {
  value: 'Dry Chemical' | 'CO2' | 'AVD' | 'Fire Ade 2000' | 'AFFF';
  label: string;
  defaultCapacity: string;
}

export const AGENT_OPTIONS: readonly AgentOption[] = [
  { value: 'Dry Chemical', label: '1. Dry Chemical', defaultCapacity: '15 lbs (4A-5B)' },
  { value: 'CO2', label: '2. CO2', defaultCapacity: '10 lbs' },
  { value: 'AVD', label: '3. AVD', defaultCapacity: '9 Litres' },
  { value: 'Fire Ade 2000', label: '4. Fire Ade 2000', defaultCapacity: '10 Litres' },
  { value: 'AFFF', label: '5. AFFF', defaultCapacity: '9 Litres' },
] as const;

export function normalizeAgentSubType(raw?: string | null): AgentOption['value'] {
  const lower = (raw || '').toLowerCase().trim();
  if (lower.includes('co2') || lower.includes('คาร์บอน')) return 'CO2';
  if (lower.includes('avd')) return 'AVD';
  if (lower.includes('fire ade')) return 'Fire Ade 2000';
  if (lower.includes('afff') || lower.includes('foam') || lower.includes('โฟม')) return 'AFFF';
  return 'Dry Chemical';
}

export function getDefaultCapacityForAgent(agent: string): string {
  const normalized = normalizeAgentSubType(agent);
  const found = AGENT_OPTIONS.find((opt) => opt.value === normalized);
  return found ? found.defaultCapacity : '15 lbs (4A-5B)';
}

export function resolveEquipmentCapacity(rawSubType?: string | null, rawCapacity?: string | null): string {
  const lowerSub = (rawSubType || '').toLowerCase();
  const cap = (rawCapacity || '').trim();

  // Keep explicit capacity when it doesn't contradict rawSubType weight/volume markers
  const has10LbsInSub = lowerSub.includes('10 lbs');
  const has15LbsInSub = lowerSub.includes('15 lbs');
  const has20LbsInSub = lowerSub.includes('20 lbs');

  if (has20LbsInSub && (!cap || cap === '15 lbs (4A-5B)')) return '20 lbs';
  if (has10LbsInSub && (!cap || cap === '15 lbs (4A-5B)')) return '10 lbs';
  if (has15LbsInSub && (!cap || cap === '15 lbs (4A-5B)')) {
    return lowerSub.includes('dry chemical') ? '15 lbs (4A-5B)' : '15 lbs';
  }

  if (cap) return cap;
  return getDefaultCapacityForAgent(rawSubType || '');
}
