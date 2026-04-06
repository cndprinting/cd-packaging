// Base adapter pattern for swappable data sources
// Each service implements this interface for future ERP/MIS/shipping integration

export interface JobData {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  quantity: number;
  dueDate: string;
}

export interface ShipmentData {
  id: string;
  carrier: string;
  trackingNumber: string;
  status: string;
  shipDate: string;
  estimatedDelivery: string;
}

export interface InventoryData {
  materialId: string;
  onHand: number;
  allocated: number;
  available: number;
}

export interface DataAdapter {
  getJobs(companyId?: string): Promise<JobData[]>;
  getShipments(orderId: string): Promise<ShipmentData[]>;
  getInventory(): Promise<InventoryData[]>;
}

export type AdapterType = "erp" | "mis" | "shipping" | "inventory";

// Placeholder: swap with real implementations
export function createAdapter(_type: AdapterType): DataAdapter {
  return {
    async getJobs() { return []; },
    async getShipments() { return []; },
    async getInventory() { return []; },
  };
}
