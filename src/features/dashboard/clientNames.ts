import type { ClientUsage } from '@/services/api/clientUsage';
type Client = ClientUsage['clients'][number];
export const clientDisplayName = (client: Client, fallback: string, peers: Client[] = []) => {
  const label = client.name || client.keyHint;
  const duplicate =
    label && peers.some((peer) => peer.id !== client.id && (peer.name || peer.keyHint) === label);
  return !label || duplicate ? `${label || fallback} · ${client.id.slice(-6)}` : label;
};
