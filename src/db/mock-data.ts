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
    defaultHourlyRate: 165.0,
  },
  {
    id: "usr_eng_2",
    name: "Elena Rostova",
    email: "elena@engineering.com",
    role: "engineer",
    qbEmployeeName: "Elena Rostova",
    defaultHourlyRate: 155.0,
  },
  {
    id: "usr_eng_3",
    name: "Marcus Vance",
    email: "marcus@engineering.com",
    role: "engineer",
    qbEmployeeName: "Marcus Vance",
    defaultHourlyRate: 125.0,
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
      {
        id: "job_2_2",
        customerId: "cust_2",
        name: "Aqueduct Flow Gate Replacement",
        fullQbJobName: "Metro Water District:Aqueduct Flow Gate Replacement",
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
      {
        id: "job_3_2",
        customerId: "cust_3",
        name: "Retaining Wall Geotechnical Survey",
        fullQbJobName: "Highland Industrial Park:Retaining Wall Geotechnical Survey",
        isActive: true,
      },
    ],
  },
  {
    id: "cust_4",
    name: "Cascade Tunnel Authority",
    qbName: "Cascade Tunnel Authority",
    isActive: true,
    jobs: [
      {
        id: "job_4_1",
        customerId: "cust_4",
        name: "Ventilation Shaft Dynamic Analysis",
        fullQbJobName: "Cascade Tunnel Authority:Ventilation Shaft Dynamic Analysis",
        isActive: true,
      },
    ],
  },
  {
    id: "cust_5",
    name: "Pacific Power Grid",
    qbName: "Pacific Power Grid",
    isActive: true,
    jobs: [
      {
        id: "job_5_1",
        customerId: "cust_5",
        name: "High-Voltage Transformer Foundation",
        fullQbJobName: "Pacific Power Grid:High-Voltage Transformer Foundation",
        isActive: true,
      },
    ],
  },
  {
    id: "cust_6",
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
    name: "Structural Calculations & Analysis",
    qbItemName: "Calculations",
    defaultBillable: true,
  },
  {
    id: "srv_4",
    name: "Client Consultation & Site Walk",
    qbItemName: "Consulting",
    defaultBillable: true,
  },
  {
    id: "srv_5",
    name: "Environmental & Safety Audit",
    qbItemName: "Safety Audit",
    defaultBillable: true,
  },
  {
    id: "srv_6",
    name: "Administrative / Internal Overhead",
    qbItemName: "Admin Overhead",
    defaultBillable: false,
  },
];

export const initialTimeEntries: TimeEntryItem[] = [
  // Today (2026-11-22)
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
    date: "2026-11-22",
    durationMinutes: 240, // 4h 00m
    locationType: "on_site",
    locationName: "Plant 4 Turbines - Bay A",
    latitude: 37.7749,
    longitude: -122.4194,
    notes: "High-speed optical alignment check on secondary bearing casing. Calibrated laser micrometer.",
    isBillable: true,
    status: "submitted",
    createdAt: "2026-11-22T02:00:00Z",
  },
  {
    id: "entry_2",
    userId: "usr_eng_2",
    userName: "Elena Rostova",
    customerId: "cust_2",
    customerName: "Metro Water District",
    jobId: "job_2_1",
    jobName: "Pumping Station B Seismic Retrofit",
    serviceItemId: "srv_3",
    serviceItemName: "Structural Calculations & Analysis",
    date: "2026-11-22",
    durationMinutes: 180, // 3h 00m
    locationType: "office",
    locationName: "Structural Engineering Lab",
    notes: "Base isolator deflection matrix calculations and seismic dampening curves.",
    isBillable: true,
    status: "submitted",
    createdAt: "2026-11-22T01:30:00Z",
  },

  // Yesterday (2026-11-21)
  {
    id: "entry_3",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_2",
    customerName: "Metro Water District",
    jobId: "job_2_1",
    jobName: "Pumping Station B Seismic Retrofit",
    serviceItemId: "srv_1",
    serviceItemName: "Field Engineering & Inspection",
    date: "2026-11-21",
    durationMinutes: 210, // 3h 30m
    locationType: "on_site",
    locationName: "Station B Intake Tunnel",
    latitude: 37.7833,
    longitude: -122.4167,
    notes: "Ultrasonic concrete core testing on bedrock footing anchor bolts.",
    isBillable: true,
    status: "approved",
    createdAt: "2026-11-21T14:00:00Z",
  },
  {
    id: "entry_4",
    userId: "usr_eng_3",
    userName: "Marcus Vance",
    customerId: "cust_3",
    customerName: "Highland Industrial Park",
    jobId: "job_3_1",
    jobName: "Phase 2 Drainage Engineering",
    serviceItemId: "srv_2",
    serviceItemName: "CAD Drafting & Modeling",
    date: "2026-11-21",
    durationMinutes: 270, // 4h 30m
    locationType: "office",
    locationName: "CAD Workstation 4",
    notes: "Civil 3D retention basin 3D surfaces and cross-sectional storm inlet profiles.",
    isBillable: true,
    status: "approved",
    createdAt: "2026-11-21T16:45:00Z",
  },
  {
    id: "entry_5",
    userId: "usr_eng_2",
    userName: "Elena Rostova",
    customerId: "cust_4",
    customerName: "Cascade Tunnel Authority",
    jobId: "job_4_1",
    jobName: "Ventilation Shaft Dynamic Analysis",
    serviceItemId: "srv_4",
    serviceItemName: "Client Consultation & Site Walk",
    date: "2026-11-21",
    durationMinutes: 120, // 2h 00m
    locationType: "travel",
    locationName: "Cascade County Transit HQ",
    notes: "Transit authority board briefing on emergency ventilation airflow dynamics.",
    isBillable: true,
    status: "approved",
    createdAt: "2026-11-21T18:00:00Z",
  },

  // Earlier This Week (2026-11-18 - 2026-11-20)
  {
    id: "entry_6",
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
    notes: "Measured vibration harmonic oscillations on turbine shaft bearing housing.",
    isBillable: true,
    status: "approved",
    createdAt: "2026-11-20T14:30:00Z",
  },
  {
    id: "entry_7",
    userId: "usr_eng_3",
    userName: "Marcus Vance",
    customerId: "cust_5",
    customerName: "Pacific Power Grid",
    jobId: "job_5_1",
    jobName: "High-Voltage Transformer Foundation",
    serviceItemId: "srv_2",
    serviceItemName: "CAD Drafting & Modeling",
    date: "2026-11-19",
    durationMinutes: 300, // 5h 00m
    locationType: "office",
    locationName: "CAD Suite 1",
    notes: "Rebar schedule detailing and seismic tie spacing specifications.",
    isBillable: true,
    status: "approved",
    createdAt: "2026-11-19T15:00:00Z",
  },
  {
    id: "entry_8",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_6",
    customerName: "Internal Overhead",
    serviceItemId: "srv_6",
    serviceItemName: "Administrative / Internal Overhead",
    date: "2026-11-19",
    durationMinutes: 60, // 1h 00m
    locationType: "office",
    locationName: "Conference Room B",
    notes: "Monthly OSHA compliance & field gear calibration meeting.",
    isBillable: false,
    status: "approved",
    createdAt: "2026-11-19T09:00:00Z",
  },
  {
    id: "entry_9",
    userId: "usr_eng_2",
    userName: "Elena Rostova",
    customerId: "cust_1",
    customerName: "Apex Energy Solutions",
    jobId: "job_1_2",
    jobName: "Substation Safety Audit",
    serviceItemId: "srv_5",
    serviceItemName: "Environmental & Safety Audit",
    date: "2026-11-18",
    durationMinutes: 240, // 4h 00m
    locationType: "on_site",
    locationName: "Substation 12 High-Bay",
    notes: "Thermographic imaging of capacitor banks and transformer lead insulators.",
    isBillable: true,
    status: "approved",
    createdAt: "2026-11-18T13:30:00Z",
  },

  // Last Week (2026-11-10 - 2026-11-16)
  {
    id: "entry_10",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_3",
    customerName: "Highland Industrial Park",
    jobId: "job_3_2",
    jobName: "Retaining Wall Geotechnical Survey",
    serviceItemId: "srv_1",
    serviceItemName: "Field Engineering & Inspection",
    date: "2026-11-14",
    durationMinutes: 360, // 6h 00m
    locationType: "on_site",
    locationName: "West Perimeter Slope",
    latitude: 37.8044,
    longitude: -122.2712,
    notes: "Inclinometer depth soundings across 5 monitoring boreholes along retaining wall.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-11-14T17:00:00Z",
  },
  {
    id: "entry_11",
    userId: "usr_eng_2",
    userName: "Elena Rostova",
    customerId: "cust_4",
    customerName: "Cascade Tunnel Authority",
    jobId: "job_4_1",
    jobName: "Ventilation Shaft Dynamic Analysis",
    serviceItemId: "srv_3",
    serviceItemName: "Structural Calculations & Analysis",
    date: "2026-11-13",
    durationMinutes: 300, // 5h 00m
    locationType: "remote",
    locationName: "Remote Workstation",
    notes: "Transient pressure wave numerical simulation for 120 mph train passage.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-11-13T16:00:00Z",
  },
  {
    id: "entry_12",
    userId: "usr_eng_3",
    userName: "Marcus Vance",
    customerId: "cust_2",
    customerName: "Metro Water District",
    jobId: "job_2_2",
    jobName: "Aqueduct Flow Gate Replacement",
    serviceItemId: "srv_2",
    serviceItemName: "CAD Drafting & Modeling",
    date: "2026-11-12",
    durationMinutes: 240, // 4h 00m
    locationType: "office",
    locationName: "Engineering Main Office",
    notes: "Hydraulic actuator mounting bracket fabrication drawings.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-11-12T14:30:00Z",
  },
  {
    id: "entry_13",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_5",
    customerName: "Pacific Power Grid",
    jobId: "job_5_1",
    jobName: "High-Voltage Transformer Foundation",
    serviceItemId: "srv_1",
    serviceItemName: "Field Engineering & Inspection",
    date: "2026-11-11",
    durationMinutes: 210, // 3h 30m
    locationType: "on_site",
    locationName: "Switchyard Substation G",
    notes: "Witnessed 28-day concrete compression cylinder break tests (average 5,420 psi).",
    isBillable: true,
    status: "exported",
    createdAt: "2026-11-11T12:00:00Z",
  },

  // Earlier This Month (2026-11-03 - 2026-11-07)
  {
    id: "entry_14",
    userId: "usr_eng_2",
    userName: "Elena Rostova",
    customerId: "cust_2",
    customerName: "Metro Water District",
    jobId: "job_2_1",
    jobName: "Pumping Station B Seismic Retrofit",
    serviceItemId: "srv_3",
    serviceItemName: "Structural Calculations & Analysis",
    date: "2026-11-06",
    durationMinutes: 330, // 5h 30m
    locationType: "office",
    locationName: "Structural Engineering Lab",
    notes: "Nonlinear pushover analysis for existing reinforced concrete columns.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-11-06T15:00:00Z",
  },
  {
    id: "entry_15",
    userId: "usr_eng_3",
    userName: "Marcus Vance",
    customerId: "cust_1",
    customerName: "Apex Energy Solutions",
    jobId: "job_1_1",
    jobName: "Turbine Unit 4 Upgrade",
    serviceItemId: "srv_2",
    serviceItemName: "CAD Drafting & Modeling",
    date: "2026-11-05",
    durationMinutes: 240, // 4h 00m
    locationType: "office",
    locationName: "CAD Suite 2",
    notes: "Cooling water piping isometric spools and hanger details.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-11-05T14:00:00Z",
  },

  // Last Month (October 2026)
  {
    id: "entry_16",
    userId: "usr_eng_1",
    userName: "Doug Mitchell",
    customerId: "cust_1",
    customerName: "Apex Energy Solutions",
    jobId: "job_1_1",
    jobName: "Turbine Unit 4 Upgrade",
    serviceItemId: "srv_1",
    serviceItemName: "Field Engineering & Inspection",
    date: "2026-10-29",
    durationMinutes: 300, // 5h 00m
    locationType: "on_site",
    locationName: "Plant 4 Turbines",
    notes: "Pre-shutdown survey and baseline vibration logging.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-10-29T16:00:00Z",
  },
  {
    id: "entry_17",
    userId: "usr_eng_2",
    userName: "Elena Rostova",
    customerId: "cust_3",
    customerName: "Highland Industrial Park",
    jobId: "job_3_2",
    jobName: "Retaining Wall Geotechnical Survey",
    serviceItemId: "srv_3",
    serviceItemName: "Structural Calculations & Analysis",
    date: "2026-10-28",
    durationMinutes: 240, // 4h 00m
    locationType: "office",
    locationName: "Lab Room 101",
    notes: "Rankine active earth pressure coefficients and sliding factor of safety.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-10-28T14:00:00Z",
  },
  {
    id: "entry_18",
    userId: "usr_eng_3",
    userName: "Marcus Vance",
    customerId: "cust_4",
    customerName: "Cascade Tunnel Authority",
    jobId: "job_4_1",
    jobName: "Ventilation Shaft Dynamic Analysis",
    serviceItemId: "srv_2",
    serviceItemName: "CAD Drafting & Modeling",
    date: "2026-10-24",
    durationMinutes: 285, // 4h 45m
    locationType: "office",
    locationName: "CAD Suite 1",
    notes: "3D BIM geometry export for computational fluid dynamics mesh generation.",
    isBillable: true,
    status: "exported",
    createdAt: "2026-10-24T16:30:00Z",
  },
];
