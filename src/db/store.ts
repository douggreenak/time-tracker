import {
  initialCustomers,
  initialServiceItems,
  initialTimeEntries,
  initialUsers,
  CustomerItem,
  JobItem,
  ServiceItem,
  TimeEntryItem,
  UserItem,
} from "./mock-data";

// In-memory data store for local dev / instant out-of-the-box operation
// Persists across requests in the Node server process
let customersStore: CustomerItem[] = [...initialCustomers];
let serviceItemsStore: ServiceItem[] = [...initialServiceItems];
let timeEntriesStore: TimeEntryItem[] = [...initialTimeEntries];
let usersStore: UserItem[] = [...initialUsers];

let activeTimerStore: {
  userId: string;
  customerId?: string;
  jobId?: string;
  serviceItemId?: string;
  locationType: "office" | "on_site" | "remote" | "travel";
  locationName?: string;
  startTime: number; // timestamp in ms
  elapsedBeforePause: number; // seconds
  isRunning: boolean;
  notes?: string;
} | null = null;

export const dataStore = {
  // Users
  getUsers: async (): Promise<UserItem[]> => usersStore,
  getUserById: async (id: string): Promise<UserItem | undefined> =>
    usersStore.find((u) => u.id === id),

  // Customers & Jobs
  getCustomers: async (): Promise<CustomerItem[]> => customersStore,
  addCustomer: async (name: string, qbName?: string): Promise<CustomerItem> => {
    const newCust: CustomerItem = {
      id: `cust_${Date.now()}`,
      name,
      qbName: qbName || name,
      isActive: true,
      jobs: [],
    };
    customersStore.push(newCust);
    return newCust;
  },
  addJob: async (customerId: string, name: string): Promise<JobItem | null> => {
    const cust = customersStore.find((c) => c.id === customerId);
    if (!cust) return null;
    const newJob: JobItem = {
      id: `job_${Date.now()}`,
      customerId,
      name,
      fullQbJobName: `${cust.qbName}:${name}`,
      isActive: true,
    };
    cust.jobs.push(newJob);
    return newJob;
  },

  // Service Items
  getServiceItems: async (): Promise<ServiceItem[]> => serviceItemsStore,
  addServiceItem: async (name: string, qbItemName?: string, defaultBillable: boolean = true): Promise<ServiceItem> => {
    const newItem: ServiceItem = {
      id: `srv_${Date.now()}`,
      name,
      qbItemName: qbItemName || name,
      defaultBillable,
    };
    serviceItemsStore.push(newItem);
    return newItem;
  },

  // Time Entries
  getTimeEntries: async (filters?: {
    startDate?: string;
    endDate?: string;
    customerId?: string;
    userId?: string;
    status?: string;
    isBillable?: boolean;
  }): Promise<TimeEntryItem[]> => {
    return timeEntriesStore.filter((entry) => {
      if (filters?.startDate && entry.date < filters.startDate) return false;
      if (filters?.endDate && entry.date > filters.endDate) return false;
      if (filters?.customerId && entry.customerId !== filters.customerId) return false;
      if (filters?.userId && entry.userId !== filters.userId) return false;
      if (filters?.status && filters.status !== "all" && entry.status !== filters.status) return false;
      if (filters?.isBillable !== undefined && entry.isBillable !== filters.isBillable) return false;
      return true;
    }).sort((a, b) => (b.date > a.date ? 1 : -1));
  },

  getTimeEntryById: async (id: string): Promise<TimeEntryItem | undefined> =>
    timeEntriesStore.find((e) => e.id === id),

  createTimeEntry: async (entry: Omit<TimeEntryItem, "id" | "createdAt">): Promise<TimeEntryItem> => {
    const newEntry: TimeEntryItem = {
      ...entry,
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    timeEntriesStore.unshift(newEntry);
    return newEntry;
  },

  updateTimeEntry: async (id: string, updates: Partial<TimeEntryItem>): Promise<TimeEntryItem | null> => {
    const index = timeEntriesStore.findIndex((e) => e.id === id);
    if (index === -1) return null;
    timeEntriesStore[index] = { ...timeEntriesStore[index], ...updates };
    return timeEntriesStore[index];
  },

  deleteTimeEntry: async (id: string): Promise<boolean> => {
    const prevLength = timeEntriesStore.length;
    timeEntriesStore = timeEntriesStore.filter((e) => e.id !== id);
    return timeEntriesStore.length < prevLength;
  },

  // Active Timer Management
  getActiveTimer: async (userId: string) => {
    if (activeTimerStore && activeTimerStore.userId === userId) {
      return activeTimerStore;
    }
    return null;
  },

  startTimer: async (params: {
    userId: string;
    customerId?: string;
    jobId?: string;
    serviceItemId?: string;
    locationType: "office" | "on_site" | "remote" | "travel";
    locationName?: string;
    notes?: string;
  }) => {
    activeTimerStore = {
      ...params,
      startTime: Date.now(),
      elapsedBeforePause: 0,
      isRunning: true,
    };
    return activeTimerStore;
  },

  pauseTimer: async (userId: string) => {
    if (activeTimerStore && activeTimerStore.userId === userId && activeTimerStore.isRunning) {
      const additionalSeconds = Math.floor((Date.now() - activeTimerStore.startTime) / 1000);
      activeTimerStore.elapsedBeforePause += additionalSeconds;
      activeTimerStore.isRunning = false;
    }
    return activeTimerStore;
  },

  resumeTimer: async (userId: string) => {
    if (activeTimerStore && activeTimerStore.userId === userId && !activeTimerStore.isRunning) {
      activeTimerStore.startTime = Date.now();
      activeTimerStore.isRunning = true;
    }
    return activeTimerStore;
  },

  stopTimer: async (userId: string): Promise<TimeEntryItem | null> => {
    if (!activeTimerStore || activeTimerStore.userId !== userId) return null;

    let totalSeconds = activeTimerStore.elapsedBeforePause;
    if (activeTimerStore.isRunning) {
      totalSeconds += Math.floor((Date.now() - activeTimerStore.startTime) / 1000);
    }

    const durationMinutes = Math.max(1, Math.round(totalSeconds / 60));

    // Look up customer and service item names
    const cust = customersStore.find((c) => c.id === activeTimerStore!.customerId);
    const job = cust?.jobs.find((j) => j.id === activeTimerStore!.jobId);
    const srv = serviceItemsStore.find((s) => s.id === activeTimerStore!.serviceItemId) || serviceItemsStore[0];
    const user = usersStore.find((u) => u.id === userId) || usersStore[0];

    const todayStr = new Date().toISOString().split("T")[0];

    const newEntry = await dataStore.createTimeEntry({
      userId,
      userName: user.name,
      customerId: cust?.id || customersStore[0].id,
      customerName: cust?.name || customersStore[0].name,
      jobId: job?.id,
      jobName: job?.name,
      serviceItemId: srv.id,
      serviceItemName: srv.name,
      date: todayStr,
      durationMinutes,
      locationType: activeTimerStore.locationType,
      locationName: activeTimerStore.locationName,
      notes: activeTimerStore.notes || "Recorded via Live Timer",
      isBillable: srv.defaultBillable,
      status: "submitted",
    });

    activeTimerStore = null;
    return newEntry;
  },

  discardTimer: async (userId: string) => {
    if (activeTimerStore && activeTimerStore.userId === userId) {
      activeTimerStore = null;
      return true;
    }
    return false;
  },
};
