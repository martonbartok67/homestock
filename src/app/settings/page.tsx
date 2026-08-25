import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getHouseholdSettings, updateHouseholdSettings } from '@/lib/api';
import { Settings, Notification, UserType } from '@/types';
import { NotificationType } from '@/components/Notifications/Notifications';;
import { RootState } from '@/store';
import { removeNotification } from '@/store/notificationsSlice';
import { useDispatch, useSelector } from 'react-redux';

interface Settings {
  notificationPreferences: {
    oneDayBefore: boolean;
    threeDaysBefore: boolean;
    sevenDaysBefore: boolean;
  };
}

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>({ notificationPreferences: { oneDayBefore: false, threeDaysBefore: false, sevenDaysBefore: false } });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const data = await getHouseholdSettings(user.householdId);
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateHouseholdSettings(user.householdId, settings);
      alert('Settings updated successfully');
    } catch (error) {
      console.error('Failed to update settings:', error);
      alert('Failed to update settings');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [name]: checked
      }
    }));
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Expiry Notifications</h2>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="oneDayBefore"
              name="oneDayBefore"
              checked={settings.notificationPreferences.oneDayBefore}
              onChange={handleChange}
              className="mr-2"
            />
            <label htmlFor="oneDayBefore">1 day before expiry</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="threeDaysBefore"
              name="threeDaysBefore"
              checked={settings.notificationPreferences.threeDaysBefore}
              onChange={handleChange}
              className="mr-2"
            />
            <label htmlFor="threeDaysBefore">3 days before expiry</label>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="sevenDaysBefore"
              name="sevenDaysBefore"
              checked={settings.notificationPreferences.sevenDaysBefore}
              onChange={handleChange}
              className="mr-2"
            />
            <label htmlFor="sevenDaysBefore">7 days before expiry</label>
          </div>
        </div>
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Save Settings</button>
      </form>
    </div>
  );
};

export default SettingsPage;