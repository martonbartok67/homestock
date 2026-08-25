import { Settings } from '@/types';
import axios from 'axios';
import { NotificationType } from '@/types';;

export const getHouseholdSettings = async (householdId: string): Promise<Settings> => {
  const response = await fetch(`/api/households/${householdId}/settings`);
  if (!response.ok) {
    throw new Error('Failed to fetch household settings');
  }
  return response.json();
};

export const updateHouseholdSettings = async (householdId: string, settings: Settings): Promise<void> => {
  const response = await fetch(`/api/households/${householdId}/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    throw new Error('Failed to update household settings');
  }
};

export const getUpcomingExpiries = async (householdId: string): Promise<{ id: string; name: string; expiryDate: string }[]> => {
  const response = await fetch(`/api/households/${householdId}/expiries`);
  if (!response.ok) {
    throw new Error('Failed to fetch upcoming expiries');
  }
  return response.json();
};

export const sendNotification = async (userId: string, message: string): Promise<void> => {
  const response = await fetch(`/api/users/${userId}/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    throw new Error('Failed to send notification');
  }
};

export const scheduleNotification = async (userId: string, message: string, scheduleTime: Date): Promise<void> => {
  const response = await fetch(`/api/users/${userId}/notifications/schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, scheduleTime }),
  });
  if (!response.ok) {
    throw new Error('Failed to schedule notification');
  }
};