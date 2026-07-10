export type User = {
  user_id: number;
  name: string;
  email: string;
  dob: string;
  plan_type: 'Free' | 'Monthly' | 'Annual';
  plan_tier?: string | null;
  billing_cycle?: string | null;
  subscription_status: string;
  token_balance?: number;
  trial_started_at: string | null;
  trial_photos_used: number;
};

export type Photo = {
  photo_id: number;
  score: number | null;
  sub_scores: Record<string, number> | null;
  status: string;
  upload_date: string;
  url: string | null;
};

export type Enhancement = {
  enhancement_id: number;
  photo_id: number;
  version_number: number;
  score: number | null;
  sub_scores: Record<string, number> | null;
  state: 'pending' | 'saved' | 'discarded';
  prompt: string | null;
  url: string | null;
};

export type LibraryItem = {
  kind: 'original' | 'enhanced';
  photo_id: number;
  enhancement_id: number | null;
  score: number | null;
  date: string;
  status: string;
  version_number: number | null;
  url: string | null;
  label: string;
  prompt?: string | null;
};

export type AuthStackParams = {
  Landing: undefined;
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  Otp: { email: string };
  ResetPassword: { email: string; otp: string };
};

export type AppStackParams = {
  Tabs: undefined;
  PhotoUpload: undefined;
  Score: { photos: Photo[]; index?: number };
  Enhance: { photoId: number };
  Compare: { original: Photo; enhanced: Enhancement };
  ImageDetail: { photoId: number };
};

export type TabParams = {
  Home: undefined;
  Gallery: undefined;
  Library: undefined;
  Profile: undefined;
};

export type ProfileStackParams = {
  Subscription: undefined;
  Settings: undefined;
  ChangePassword: undefined;
};
