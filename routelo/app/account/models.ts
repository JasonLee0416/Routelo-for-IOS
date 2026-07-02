export type AccountMode = 'guest' | 'member';
export type AccountPlan = 'guest' | 'free' | 'premium';
export type AccountStatus =
  | 'active'
  | 'verification_required'
  | 'suspended'
  | 'deletion_pending';

export type EnergyType =
  | 'gasoline'
  | 'diesel'
  | 'lpg'
  | 'hybrid'
  | 'electric'
  | 'hydrogen'
  | 'other';

export type UserProfile = {
  schemaVersion: 1;
  id: string;
  accountMode: AccountMode;
  plan: AccountPlan;
  status: AccountStatus;
  displayName: string;
  email?: string;
  primaryVehicleId?: string;
  createdAt: string;
  updatedAt: string;
};

export type VehicleProfile = {
  schemaVersion: 1;
  id: string;
  userId: string;
  nickname: string;
  manufacturer?: string;
  model: string;
  trim?: string;
  modelYear?: number;
  vehicleType: 'car' | 'compact' | 'suv' | 'van' | 'truck' | 'motorcycle' | 'other';
  energyType: EnergyType;
  tankCapacityLiters?: number;
  batteryCapacityKwh?: number;
  expectedEfficiency?: number;
  odometerKm?: number;
  isPrimary: boolean;
};

export type AccountState = {
  profile: UserProfile;
  vehicles: VehicleProfile[];
};

export interface AuthenticationService {
  register(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ userId: string; requiresVerification: boolean }>;
  signIn(email: string, password: string): Promise<{ userId: string }>;
  signOut(): Promise<void>;
}

