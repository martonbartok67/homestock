import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Notification = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
};

type NotificationsState = {
  notifications: Notification[];
};

const initialState: NotificationsState = {
  notifications: [],
};

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload,
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
  },
});

export const { addNotification, removeNotification, clearNotifications } = notificationsSlice.actions;

export default notificationsSlice.reducer;