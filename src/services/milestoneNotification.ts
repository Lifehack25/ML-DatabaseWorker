import { ScanMilestoneEvent } from '../types';

type MilestoneBindings = {
  CORE_API_BASE_URL?: string;
  CORE_API_SHARED_SECRET?: string;
};

const MILESTONE_ENDPOINT = '/internal/notifications/milestone';

export async function sendMilestoneNotification(
  env: MilestoneBindings,
  payload: ScanMilestoneEvent
): Promise<void> {
  const baseUrl = env.CORE_API_BASE_URL?.trim();
  const sharedSecret = env.CORE_API_SHARED_SECRET?.trim();

  if (!baseUrl || !sharedSecret) {
    console.warn(
      'Milestone notification skipped: CORE_API_BASE_URL or CORE_API_SHARED_SECRET not configured.'
    );
    return;
  }

  const endpoint = `${baseUrl.replace(/\/$/, '')}${MILESTONE_ENDPOINT}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': sharedSecret
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Failed to send milestone notification (status ${response.status}): ${errorText}`
      );
    }
  } catch (error) {
    console.error('Error sending milestone notification:', error);
  }
}

