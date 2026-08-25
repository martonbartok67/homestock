import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { removeNotification } from '@/store/notificationsSlice';

interface NotificationType {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const Notifications: React.FC = () => {
  const notifications = useSelector((state: RootState) => state.notifications);
  const dispatch = useDispatch();

  const handleClose = (id: string) => {
    dispatch(removeNotification(id));
  };

  return (
    <div className="notifications">
      {notifications.map((notification: NotificationType) => (
        <div key={notification.id} className={`notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => handleClose(notification.id)}>X</button>
        </div>
      ))}
    </div>
  );
};

export default Notifications;