export interface CustomerItem {
  id: string;
  name: string;
  qbName: string;
  isActive: boolean;
  jobs: JobItem[];
}

export interface JobItem {
  id: string;
  customerId: string;
  name: string;
  fullQbJobName: string;
  isActive: boolean;
}

export interface ServiceItem {
  id: string;
  name: string;
  qbItemName: string;
  defaultBillable: boolean;
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "engineer" | "accountant" | "admin";
  qbEmployeeName: string;
  defaultHourlyRate: number;
}

export interface TimeEntryItem {
  id: string;
  userId: string;
  userName: string;
  customerId: string;
  customerName: string;
  jobId?: string | null;
  jobName?: string | null;
  serviceItemId: string;
  serviceItemName: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  locationType: "office" | "on_site" | "remote" | "travel";
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  isBillable: boolean;
  status: "draft" | "submitted" | "approved" | "exported";
  createdAt: string;
}

export const initialUsers: UserItem[] = [
  {
    id: "usr_eng_1",
    name: "Doug Mitchell",
    email: "doug@engineering.com",
    role: "engineer",
    qbEmployeeName: "Doug Mitchell",
    defaultHourlyRate: 145.0,
  },
  {
    id: "usr_acc_1",
    name: "Sarah Jenkins",
    email: "sarah@accounting.com",
    role: "accountant",
    qbEmployeeName: "Sarah Jenkins",
    defaultHourlyRate: 95.0,
  },
];

export const initialCustomers: CustomerItem[] = [
  {
    id: "cust_1",
    name: "Apex Energy Solutions",
    qbName: "Apex Energy Solutions",
    isActive: true,
    jobs: [
      {
        id: "job_1_1",
        customerId: "cust_1",
        name: "Turbine Unit 4 Upgrade",
        fullQbJobName: "Apex Energy Solutions:Turbine Unit 4 Upgrade",
        isActive: true,
      },
      {
        id: "job_1_2",
        customerId: "cust_1",
        name: "Substation Safety Audit",
        fullQbJobName: "Apex Energy Solutions:Substation Safety Audit",
        isActive: true,
      },
    ],
  },
  {
    id: "cust_2",
    name: "Metro Water District",
    qbName: "Metro Water District",
    isActive: true,
    jobs: [
      {
        id: "job_2_1",
        customerId: "cust_2",
        name: "Pumping Station B Seismic Retrofit",
        fullQbJobName: "Metro Water District:Pumping Station B Seismic Retrofit",
        isActive: true,
      },
    ],
  },
  {
    id: "cust_3",
    name: "Highland Industrial Park",
    qbName: "Highland Industrial Park",
    isActive: true,
    jobs: [
      {
        id: "job_3_1",
        customerId: "cust_3",
        name: "Phase 2 Drainage Engineering",
        fullQbJobName: "Highland Industrial Park:Phase 2 Drainage Engineering",
        isActive: true,
      },
    ],
  },
  {
    id: "cust_4",
    name: "Internal Overhead",
    qbName: "Internal Overhead",
    isActive: true,
    jobs: [],
  },
];

export const initialServiceItems: ServiceItem[] = [
  {
    id: "srv_1",
    name: "Field Engineering & Inspection",
    qbItemName: "Field Engineering",
    defaultBillable: true,
  },
  {
    id: "srv_2",
    name: "CAD Drafting & Modeling",
    qbItemName: "CAD Drafting",
    defaultBillable: true,
  },
  {
    id: "srv_3",
    name: "Structural Calculations",
    qbItemName: "Calculations",
    defaultBillable: true,
  },
  {
    id: "srv_4",
    name: "Client Consultation & Review",
    qbItemName: "Consulting",
    defaultBillable: true,
  },
  {
    id: "srv_5",
    name: "Administrative / Internal",
    qbItemName: "Admin Overhead",
    defaultBillable: false,
  },
];

export const initialTimeEntries: TimeEntryItem[] = [
  {
    id: "entry_1",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_1",
    customerName: "Apex Energy Solutions",
    jobId: "job_1_1",
    jobName: "Turbine Unit 4 Upgrade",
    serviceItemId: "srv_1",
    serviceItemName: "Field Engineering & Inspection",
    date: "2026-11-20",
    durationMinutes: 225, // 3h 45m
    locationType: "on_site",
    locationName: "Plant 4 North Bay",
    latitude: 37.7749,
    longitude: -122.4194,
    notes: "Measured vibration harmonic oscillations on turbine shaft bearing housing. Inspected grease fittings.",
    isBillable: true,
    status: "approved",
    createdAt: "2026-11-20T14:30:00Z",
  },
  {
    id: "entry_2",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_2",
    customerName: "Metro Water District",
    jobId: "job_2_1",
    jobName: "Pumping Station B Seismic Retrofit",
    serviceItemId: "srv_3",
    serviceItemName: "Structural Calculations",
    date: "2026-11-21",
    durationMinutes: 150, // 2h 30m
    locationType: "office",
    locationName: "Engineering Office Room 302",
    notes: "Shear wall reinforcement stress analysis using FEA solver. Generated safety factor report.",
    isBillable: true,
    status: "submitted",
    createdAt: "2026-11-21T11:00:00Z",
  },
  {
    id: "entry_3",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_3",
    customerName: "Highland Industrial Park",
    jobId: "job_3_1",
    jobName: "Phase 2 Drainage Engineering",
    serviceItemId: "srv_2",
    serviceItemName: "CAD Drafting & Modeling",
    date: "2026-11-21",
    durationMinutes: 105, // 1h 45m
    locationType: "remote",
    locationName: "Home Office",
    notes: "Updated stormwater retention basin contours and culvert elevations in Civil 3D.",
    isBillable: true,
    status: "submitted",
    createdAt: "2026-11-21T16:15:00Z",
  },
  {
    id: "entry_4",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_4",
    customerName: "Internal Overhead",
    serviceItemId: "srv_5",
    serviceItemName: "Administrative / Internal",
    date: "2026-11-19",
    durationMinutes: 60, // 1h 0m
    locationType: "office",
    locationName: "Main Conference Room",
    notes: "Monthly OSHA compliance & field gear calibration meeting.",
    isBillable: false,
    status: "approved",
    createdAt: "2026-11-19T09:00:00Z",
  },
];
