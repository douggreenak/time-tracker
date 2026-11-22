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
// Held on globalThis so every route bundle (and dev hot reloads) share one store.
const g = globalThis as unknown as {
  __ttState?: {
    customers: CustomerItem[];
    serviceItems: ServiceItem[];
    timeEntries: TimeEntryItem[];
    users: UserItem[];
  };
};
const state = (g.__ttState ??= {
  customers: initialCustomers.map((c) => ({ ...c, jobs: c.jobs.map((j) => ({ ...j })) })),
  serviceItems: initialServiceItems.map((i) => ({ ...i })),
  timeEntries: initialTimeEntries.map((e) => ({ ...e })),
  users: [...initialUsers],
});

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

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export type DeleteResult = "ok" | "not_found" | "in_use";

export const dataStore = {
  // Users
  getUsers: async (): Promise<UserItem[]> => state.users,
  getUserById: async (id: string): Promise<UserItem | undefined> =>
    state.users.find((u) => u.id === id),

  // Customers & Jobs
  getCustomers: async (): Promise<CustomerItem[]> => state.customers,
  addCustomer: async (name: string, qbName?: string): Promise<CustomerItem> => {
    const newCust: CustomerItem = {
      id: `cust_${uid()}`,
      name,
      qbName: qbName || name,
      isActive: true,
      jobs: [],
    };
    state.customers.push(newCust);
    return newCust;
  },
  addJob: async (customerId: string, name: string): Promise<JobItem | null> => {
    const cust = state.customers.find((c) => c.id === customerId);
    if (!cust) return null;
    const newJob: JobItem = {
      id: `job_${uid()}`,
      customerId,
      name,
      fullQbJobName: `${cust.qbName}:${name}`,
      isActive: true,
    };
    cust.jobs.push(newJob);
    return newJob;
  },

  updateCustomer: async (
    id: string,
    updates: { name?: string; qbName?: string; isActive?: boolean }
  ): Promise<CustomerItem | null> => {
    const cust = state.customers.find((c) => c.id === id);
    if (!cust) return null;
    if (updates.name !== undefined) cust.name = updates.name;
    if (updates.qbName !== undefined) cust.qbName = updates.qbName;
    if (updates.isActive !== undefined) cust.isActive = updates.isActive;
    cust.jobs.forEach((j) => (j.fullQbJobName = `${cust.qbName}:${j.name}`));
    state.timeEntries.forEach((e) => {
      if (e.customerId === id) e.customerName = cust.name;
    });
    return cust;
  },
  deleteCustomer: async (id: string): Promise<DeleteResult> => {
    if (!state.customers.some((c) => c.id === id)) return "not_found";
    if (state.timeEntries.some((e) => e.customerId === id)) return "in_use";
    state.customers = state.customers.filter((c) => c.id !== id);
    return "ok";
  },
  updateJob: async (
    id: string,
    updates: { name?: string; isActive?: boolean }
  ): Promise<JobItem | null> => {
    for (const cust of state.customers) {
      const job = cust.jobs.find((j) => j.id === id);
      if (!job) continue;
      if (updates.name !== undefined) job.name = updates.name;
      if (updates.isActive !== undefined) job.isActive = updates.isActive;
      job.fullQbJobName = `${cust.qbName}:${job.name}`;
      state.timeEntries.forEach((e) => {
        if (e.jobId === id) e.jobName = job.name;
      });
      return job;
    }
    return null;
  },
  deleteJob: async (id: string): Promise<DeleteResult> => {
    const cust = state.customers.find((c) => c.jobs.some((j) => j.id === id));
    if (!cust) return "not_found";
    if (state.timeEntries.some((e) => e.jobId === id)) return "in_use";
    cust.jobs = cust.jobs.filter((j) => j.id !== id);
    return "ok";
  },

  // Service Items
  getServiceItems: async (): Promise<ServiceItem[]> => state.serviceItems,
  addServiceItem: async (name: string, qbItemName?: string, defaultBillable: boolean = true): Promise<ServiceItem> => {
    const newItem: ServiceItem = {
      id: `srv_${uid()}`,
      name,
      qbItemName: qbItemName || name,
      defaultBillable,
    };
    state.serviceItems.push(newItem);
    return newItem;
  },

  updateServiceItem: async (
    id: string,
    updates: { name?: string; qbItemName?: string; defaultBillable?: boolean }
  ): Promise<ServiceItem | null> => {
    const item = state.serviceItems.find((i) => i.id === id);
    if (!item) return null;
    if (updates.name !== undefined) item.name = updates.name;
    if (updates.qbItemName !== undefined) item.qbItemName = updates.qbItemName;
    if (updates.defaultBillable !== undefined) item.defaultBillable = updates.defaultBillable;
    state.timeEntries.forEach((e) => {
      if (e.serviceItemId === id) e.serviceItemName = item.name;
    });
    return item;
  },
  deleteServiceItem: async (id: string): Promise<DeleteResult> => {
    if (!state.serviceItems.some((i) => i.id === id)) return "not_found";
    if (state.timeEntries.some((e) => e.serviceItemId === id)) return "in_use";
    state.serviceItems = state.serviceItems.filter((i) => i.id !== id);
    return "ok";
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
    return state.timeEntries.filter((entry) => {
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
    state.timeEntries.find((e) => e.id === id),

  createTimeEntry: async (entry: Omit<TimeEntryItem, "id" | "createdAt">): Promise<TimeEntryItem> => {
    const newEntry: TimeEntryItem = {
      ...entry,
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    state.timeEntries.unshift(newEntry);
    return newEntry;
  },

  updateTimeEntry: async (id: string, updates: Partial<TimeEntryItem>): Promise<TimeEntryItem | null> => {
    const index = state.timeEntries.findIndex((e) => e.id === id);
    if (index === -1) return null;
    state.timeEntries[index] = { ...state.timeEntries[index], ...updates };
    return state.timeEntries[index];
  },

  deleteTimeEntry: async (id: string): Promise<boolean> => {
    const prevLength = state.timeEntries.length;
    state.timeEntries = state.timeEntries.filter((e) => e.id !== id);
    return state.timeEntries.length < prevLength;
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
    const cust = state.customers.find((c) => c.id === activeTimerStore!.customerId);
    const job = cust?.jobs.find((j) => j.id === activeTimerStore!.jobId);
    const srv = state.serviceItems.find((s) => s.id === activeTimerStore!.serviceItemId) || state.serviceItems[0];
    const user = state.users.find((u) => u.id === userId) || state.users[0];

    const todayStr = new Date().toISOString().split("T")[0];

    const newEntry = await dataStore.createTimeEntry({
      userId,
      userName: user.name,
      customerId: cust?.id || state.customers[0].id,
      customerName: cust?.name || state.customers[0].name,
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
