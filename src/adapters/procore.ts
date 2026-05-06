/**
 * Procore adapter placeholder.
 * Read-first only until Lawrence explicitly approves authentication and write workflows.
 */
export type ProcoreConnectionState = 'not_configured' | 'needs_auth' | 'ready' | 'error';

export interface ProcoreProjectSummary {
  id: string;
  name: string;
  phase?: string;
  status?: string;
}

export function getConnectionState(): ProcoreConnectionState {
  return process.env.MEMBRANE_CONNECTION_ID ? 'needs_auth' : 'not_configured';
}

export async function listProjectsReadOnly(): Promise<ProcoreProjectSummary[]> {
  throw new Error('Procore read-only sync is not wired yet. Configure Membrane/Procore connection first.');
}
