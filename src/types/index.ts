export type NotificationType = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
};

export type UserType = {
  id: string;
  name: string;
  email: string;
};