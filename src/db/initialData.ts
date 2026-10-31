export interface LocalStoreSchema {
  auth_users: Array<{
    id: string;
    email: string;
    password?: string;
    user_metadata: Record<string, any>;
    created_at: string;
  }>;
  user_roles: Array<{
    id: string;
    user_id: string;
    role: string;
    status: string;
    created_at: string;
  }>;
  delivery_zones: Array<{
    id: string;
    name: string;
    city: string;
    is_active: boolean;
    created_at: string;
  }>;
  delivery_shifts: Array<{
    id: string;
    partner_id?: string;
    slot: string;
    created_at: string;
  }>;
  delivery_partners: Array<{
    id: string;
    user_id: string;
    full_name: string;
    mobile: string;
    email: string;
    mobile_verified: boolean;
    email_verified: boolean;
    profile_photo_url: string | null;
    date_of_birth: string | null;
    gender: string | null;
    emergency_contact_name: string | null;
    emergency_contact_number: string | null;
    house_number: string | null;
    street: string | null;
    area: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    vehicle_type: string | null;
    vehicle_number: string | null;
    vehicle_brand: string | null;
    vehicle_model: string | null;
    vehicle_color: string | null;
    licence_number: string | null;
    licence_expiry: string | null;
    aadhaar_number: string | null;
    pan_number: string | null;
    bank_account_holder: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
    upi_id: string | null;
    employment_type: string | null;
    status: string;
    admin_note: string | null;
    registration_step: number;
    availability: string;
    current_latitude: number | null;
    current_longitude: number | null;
    location_updated_at: string | null;
    rating: number;
    total_deliveries: number;
    cancelled_deliveries: number;
    late_deliveries: number;
    total_requests: number;
    accepted_requests: number;
    approved_at: string | null;
    created_at: string;
  }>;
  delivery_partner_zones: Array<{
    id: string;
    partner_id: string;
    zone_id: string;
  }>;
  sellers: Array<{
    id: string;
    user_id: string;
    shop_name: string;
    business_name: string;
    mobile: string;
    email: string;
    address: string;
    latitude: number;
    longitude: number;
    status: string;
    created_at: string;
  }>;
  orders: Array<{
    id: string;
    order_code: string;
    order_number?: string;
    seller_id: string;
    customer_id?: string;
    customer_name: string;
    buyer_name?: string;
    customer_mobile: string;
    buyer_phone?: string;
    delivery_address: string;
    buyer_address?: string;
    pickup_latitude: number;
    pickup_longitude: number;
    drop_latitude: number;
    drop_longitude: number;
    pickup_address: string;
    status: string;
    delivery_otp: string;
    total: number;
    order_total?: number;
    subtotal: number;
    shipping_fee: number;
    estimated_delivery_fee: number;
    created_at: string;
    updated_at: string;
  }>;
  order_items: Array<{
    id: string;
    order_id: string;
    product_name: string;
    name?: string;
    quantity: number;
    unit_price: number;
    price?: number;
    total_price: number;
  }>;
  delivery_assignments: Array<{
    id: string;
    order_id: string;
    partner_id: string;
    status: string;
    distance_km: number;
    estimated_earning: number;
    proof_type: string | null;
    proof_value: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
    responded_at: string | null;
    expires_at: string;
    created_at: string;
    updated_at: string;
  }>;
  delivery_documents: Array<{
    id: string;
    partner_id: string;
    doc_type: string;
    file_path: string;
    expiry_date: string | null;
    status: string;
    reviewer_note: string | null;
    created_at: string;
  }>;
  delivery_earnings: Array<{
    id: string;
    partner_id: string;
    assignment_id: string | null;
    amount: number;
    type: string;
    description: string | null;
    payout_id: string | null;
    created_at: string;
  }>;
  delivery_payouts: Array<{
    id: string;
    partner_id: string;
    amount: number;
    status: string;
    period_start: string;
    period_end: string;
    paid_at: string | null;
    created_at: string;
  }>;
  delivery_notifications: Array<{
    id: string;
    partner_id: string;
    title: string;
    body: string | null;
    kind: string;
    is_read: boolean;
    created_at: string;
  }>;
  products: Array<{
    id: string;
    seller_id: string;
    name: string;
    title?: string;
    price: number;
    category: string;
    stock_quantity: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
  product_variants: Array<{
    id: string;
    product_id: string;
    sku: string;
    price: number;
    stock: number;
    title: string;
    created_at: string;
  }>;
  returns: Array<{
    id: string;
    seller_id: string;
    order_id: string;
    status: string;
    reason: string;
    refund_amount: number;
    created_at: string;
  }>;
  promotions: Array<{
    id: string;
    seller_id: string;
    code: string;
    discount_type: string;
    discount_value: number;
    is_active: boolean;
    start_date: string;
    end_date: string;
    usage_limit: number | null;
    created_at: string;
  }>;
  customer_metrics: Array<{
    id: string;
    seller_id: string;
    customer_name: string;
    total_orders: number;
    total_spend: number;
    last_order_date: string;
  }>;
  seller_settlements: Array<{
    id: string;
    seller_id: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  seller_exports: Array<{
    id: string;
    seller_id: string;
    type: string;
    format: string;
    status: string;
    created_at: string;
  }>;
  [key: string]: any[];
}

export const initialLocalData: LocalStoreSchema = {
  auth_users: [
    {
      id: "user-admin-001",
      email: "admin@localshore.test",
      password: "admin123",
      user_metadata: { full_name: "Delivery Administrator", role: "admin" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "user-partner-001",
      email: "partner@localshore.test",
      password: "partner123",
      user_metadata: { full_name: "Rahul Sharma", role: "delivery_partner" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "user-dummy-001",
      email: "dummymama3@gmail.com",
      password: "password123",
      user_metadata: { full_name: "Dummy Partner", role: "delivery_partner" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "user-vendor-001",
      email: "vendor@localshore.test",
      password: "vendor123",
      user_metadata: { full_name: "Coastal Store Owner", role: "vendor" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  user_roles: [
    {
      id: "role-1",
      user_id: "user-admin-001",
      role: "admin",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "role-2",
      user_id: "user-partner-001",
      role: "delivery_partner",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "role-3",
      user_id: "user-dummy-001",
      role: "delivery_partner",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "role-4",
      user_id: "user-vendor-001",
      role: "vendor",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  delivery_zones: [
    { id: "zone-1", name: "Bandra West & Khar", city: "Mumbai", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
    { id: "zone-2", name: "Andheri West & Juhu", city: "Mumbai", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
    { id: "zone-3", name: "South Mumbai & Colaba", city: "Mumbai", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
    { id: "zone-4", name: "Powai & Kanjurmarg", city: "Mumbai", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
    { id: "zone-5", name: "Koramangala & HSR", city: "Bengaluru", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
    { id: "zone-6", name: "Indiranagar & Domlur", city: "Bengaluru", is_active: true, created_at: "2026-01-01T00:00:00.000Z" },
  ],
  delivery_shifts: [
    { id: "shift-1", partner_id: "partner-001", slot: "morning", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "shift-2", partner_id: "partner-001", slot: "evening", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "shift-3", partner_id: "partner-002", slot: "afternoon", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "shift-4", partner_id: "partner-002", slot: "evening", created_at: "2026-01-01T00:00:00.000Z" },
  ],
  delivery_partners: [
    {
      id: "partner-001",
      user_id: "user-partner-001",
      full_name: "Rahul Sharma",
      mobile: "9876543210",
      email: "partner@localshore.test",
      mobile_verified: true,
      email_verified: true,
      profile_photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      date_of_birth: "1998-05-14",
      gender: "male",
      emergency_contact_name: "Sunita Sharma",
      emergency_contact_number: "9876500000",
      house_number: "Flat 402, Sea Breeze Apt",
      street: "Hill Road",
      area: "Bandra West",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400050",
      vehicle_type: "scooter",
      vehicle_number: "MH02EZ1234",
      vehicle_brand: "Honda",
      vehicle_model: "Activa 6G",
      vehicle_color: "Matte Black",
      licence_number: "MH0220180012345",
      licence_expiry: "2032-10-15",
      aadhaar_number: "543212348765",
      pan_number: "ABCPS1234D",
      bank_account_holder: "Rahul Sharma",
      bank_name: "HDFC Bank",
      bank_account_number: "50100234567890",
      bank_ifsc: "HDFC0000123",
      upi_id: "rahul@okaxis",
      employment_type: "full_time",
      status: "approved",
      admin_note: "Verified KYC & clean record",
      registration_step: 9,
      availability: "offline",
      current_latitude: 19.0596,
      current_longitude: 72.8295,
      location_updated_at: new Date().toISOString(),
      rating: 4.88,
      total_deliveries: 142,
      cancelled_deliveries: 1,
      late_deliveries: 3,
      total_requests: 160,
      accepted_requests: 152,
      approved_at: "2026-01-05T10:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "partner-002",
      user_id: "user-dummy-001",
      full_name: "Dummy Partner",
      mobile: "8682033021",
      email: "dummymama3@gmail.com",
      mobile_verified: true,
      email_verified: true,
      profile_photo_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
      date_of_birth: "1999-08-20",
      gender: "male",
      emergency_contact_name: "Mama Contact",
      emergency_contact_number: "8682000000",
      house_number: "Building 12",
      street: "Main Road",
      area: "Andheri West",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400058",
      vehicle_type: "bike",
      vehicle_number: "MH02AB5678",
      vehicle_brand: "Bajaj",
      vehicle_model: "Pulsar 150",
      vehicle_color: "Blue",
      licence_number: "MH0220190056789",
      licence_expiry: "2035-04-12",
      aadhaar_number: "987654321234",
      pan_number: "XYZPS9876E",
      bank_account_holder: "Dummy Partner",
      bank_name: "State Bank of India",
      bank_account_number: "30291827364",
      bank_ifsc: "SBIN0001234",
      upi_id: "dummy@upi",
      employment_type: "full_time",
      status: "approved",
      admin_note: "Approved for live test",
      registration_step: 9,
      availability: "offline",
      current_latitude: 19.1136,
      current_longitude: 72.8697,
      location_updated_at: new Date().toISOString(),
      rating: 4.92,
      total_deliveries: 45,
      cancelled_deliveries: 0,
      late_deliveries: 1,
      total_requests: 48,
      accepted_requests: 47,
      approved_at: "2026-01-05T10:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  delivery_partner_zones: [
    { id: "pz-1", partner_id: "partner-001", zone_id: "zone-1" },
    { id: "pz-2", partner_id: "partner-001", zone_id: "zone-2" },
    { id: "pz-3", partner_id: "partner-002", zone_id: "zone-1" },
    { id: "pz-4", partner_id: "partner-002", zone_id: "zone-2" },
  ],
  sellers: [
    {
      id: "seller-001",
      user_id: "user-vendor-001",
      shop_name: "Coastal Shore Organic Market",
      business_name: "Coastal Shore Retail Pvt Ltd",
      mobile: "9820011223",
      email: "vendor@localshore.test",
      address: "Shop 4, Turner Road, Bandra West, Mumbai 400050",
      latitude: 19.0585,
      longitude: 72.8335,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "seller-002",
      user_id: "user-vendor-002",
      shop_name: "Ocean Catch Fresh Seafood",
      business_name: "Ocean Catch Ltd",
      mobile: "9820099887",
      email: "ocean@localshore.test",
      address: "Shop 12, Pali Hill Market, Bandra West, Mumbai",
      latitude: 19.0625,
      longitude: 72.8275,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  orders: [
    {
      id: "order-101",
      order_code: "LS-8942",
      order_number: "LS-8942",
      seller_id: "seller-001",
      customer_name: "Ananya Deshmukh",
      buyer_name: "Ananya Deshmukh",
      customer_mobile: "+91 98201 54321",
      buyer_phone: "+91 98201 54321",
      delivery_address: "Flat 701, Sea View Residency, Carter Road, Bandra West",
      buyer_address: "Flat 701, Sea View Residency, Carter Road, Bandra West",
      pickup_address: "Shop 4, Turner Road, Bandra West, Mumbai",
      pickup_latitude: 19.0585,
      pickup_longitude: 72.8335,
      drop_latitude: 19.0645,
      drop_longitude: 72.8245,
      status: "ready_for_pickup",
      delivery_otp: "4892",
      total: 840,
      order_total: 840,
      subtotal: 780,
      shipping_fee: 60,
      estimated_delivery_fee: 65,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "order-102",
      order_code: "LS-8943",
      order_number: "LS-8943",
      seller_id: "seller-001",
      customer_name: "Vikram Malhotra",
      buyer_name: "Vikram Malhotra",
      customer_mobile: "+91 98333 11224",
      buyer_phone: "+91 98333 11224",
      delivery_address: "Villa 3, Perry Cross Road, Bandra West, Mumbai",
      buyer_address: "Villa 3, Perry Cross Road, Bandra West, Mumbai",
      pickup_address: "Shop 4, Turner Road, Bandra West, Mumbai",
      pickup_latitude: 19.0585,
      pickup_longitude: 72.8335,
      drop_latitude: 19.0552,
      drop_longitude: 72.8315,
      status: "assigned",
      delivery_otp: "7124",
      total: 1450,
      order_total: 1450,
      subtotal: 1390,
      shipping_fee: 60,
      estimated_delivery_fee: 75,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  order_items: [
    {
      id: "item-1",
      order_id: "order-101",
      product_name: "Organic Alphonso Mangoes (1kg)",
      name: "Organic Alphonso Mangoes (1kg)",
      quantity: 2,
      unit_price: 320,
      price: 320,
      total_price: 640,
    },
    {
      id: "item-2",
      order_id: "order-101",
      product_name: "Fresh Sourdough Bread",
      name: "Fresh Sourdough Bread",
      quantity: 1,
      unit_price: 140,
      price: 140,
      total_price: 140,
    },
    {
      id: "item-3",
      order_id: "order-102",
      product_name: "Cold Pressed Olive Oil 500ml",
      name: "Cold Pressed Olive Oil 500ml",
      quantity: 2,
      unit_price: 650,
      price: 650,
      total_price: 1300,
    },
  ],
  delivery_assignments: [
    {
      id: "assign-101",
      order_id: "order-101",
      partner_id: "partner-001",
      status: "pending",
      distance_km: 2.8,
      estimated_earning: 65,
      proof_type: null,
      proof_value: null,
      picked_up_at: null,
      delivered_at: null,
      responded_at: null,
      expires_at: new Date(Date.now() + 45 * 1000).toISOString(),
      created_at: new Date(Date.now() - 10 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  delivery_documents: [
    {
      id: "doc-1",
      partner_id: "partner-001",
      doc_type: "profile_photo",
      file_path: "user-partner-001/profile_photo.jpg",
      expiry_date: null,
      status: "verified",
      reviewer_note: "Verified clear photo",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "doc-2",
      partner_id: "partner-001",
      doc_type: "licence",
      file_path: "user-partner-001/licence.pdf",
      expiry_date: "2032-10-15",
      status: "verified",
      reviewer_note: "Valid 2-wheeler license",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "doc-3",
      partner_id: "partner-001",
      doc_type: "aadhaar_front",
      file_path: "user-partner-001/aadhaar_front.jpg",
      expiry_date: null,
      status: "verified",
      reviewer_note: "Aadhaar verified",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "doc-4",
      partner_id: "partner-001",
      doc_type: "pan",
      file_path: "user-partner-001/pan.jpg",
      expiry_date: null,
      status: "verified",
      reviewer_note: "PAN verified",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  delivery_earnings: [
    {
      id: "earn-1",
      partner_id: "partner-001",
      assignment_id: null,
      amount: 65,
      type: "delivery_fee",
      description: "Order LS-8901 delivery",
      payout_id: null,
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: "earn-2",
      partner_id: "partner-001",
      assignment_id: null,
      amount: 80,
      type: "delivery_fee",
      description: "Order LS-8910 delivery",
      payout_id: null,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: "earn-3",
      partner_id: "partner-001",
      assignment_id: null,
      amount: 50,
      type: "tip",
      description: "Customer tip on LS-8910",
      payout_id: null,
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: "earn-4",
      partner_id: "partner-001",
      assignment_id: null,
      amount: 150,
      type: "bonus",
      description: "Peak hour delivery bonus",
      payout_id: null,
      created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    },
  ],
  delivery_payouts: [
    {
      id: "payout-1",
      partner_id: "partner-001",
      amount: 2450,
      status: "paid",
      period_start: "2026-09-21T00:00:00.000Z",
      period_end: "2026-09-27T23:59:59.000Z",
      paid_at: "2026-09-28T14:30:00.000Z",
      created_at: "2026-09-28T10:00:00.000Z",
    },
  ],
  delivery_notifications: [
    {
      id: "notif-1",
      partner_id: "partner-001",
      title: "Welcome to Local Shore!",
      body: "Your partner profile is verified and approved. You can now toggle online to receive delivery requests.",
      kind: "welcome",
      is_read: false,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "notif-2",
      partner_id: "partner-001",
      title: "Weekly Incentive Active",
      body: "Complete 20 deliveries this week to earn ₹500 extra bonus.",
      kind: "promo",
      is_read: true,
      created_at: "2026-01-02T00:00:00.000Z",
    },
  ],
  products: [
    {
      id: "prod-1",
      seller_id: "seller-001",
      name: "Organic Alphonso Mangoes (1kg)",
      title: "Organic Alphonso Mangoes (1kg)",
      price: 320,
      category: "Fruits",
      stock_quantity: 45,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "prod-2",
      seller_id: "seller-001",
      name: "Fresh Sourdough Bread",
      title: "Fresh Sourdough Bread",
      price: 140,
      category: "Bakery",
      stock_quantity: 20,
      is_active: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  product_variants: [
    { id: "var-1", product_id: "prod-1", sku: "MNG-1KG", price: 320, stock: 45, title: "1 kg box", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "var-2", product_id: "prod-2", sku: "BRD-SOUR", price: 140, stock: 20, title: "Standard Loaf", created_at: "2026-01-01T00:00:00.000Z" },
  ],
  returns: [
    {
      id: "ret-1",
      seller_id: "seller-001",
      order_id: "order-101",
      status: "pending",
      reason: "Item packaging slightly crushed",
      refund_amount: 140,
      created_at: new Date(Date.now() - 4800 * 1000).toISOString(),
    },
  ],
  promotions: [
    {
      id: "promo-1",
      seller_id: "seller-001",
      code: "SHORE20",
      discount_type: "percentage",
      discount_value: 20,
      is_active: true,
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2026-12-31T23:59:59.000Z",
      usage_limit: 500,
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  customer_metrics: [
    {
      id: "cm-1",
      seller_id: "seller-001",
      customer_name: "Ananya Deshmukh",
      total_orders: 12,
      total_spend: 8640,
      last_order_date: new Date().toISOString(),
    },
    {
      id: "cm-2",
      seller_id: "seller-001",
      customer_name: "Vikram Malhotra",
      total_orders: 8,
      total_spend: 6120,
      last_order_date: new Date().toISOString(),
    },
  ],
  seller_settlements: [
    {
      id: "settle-1",
      seller_id: "seller-001",
      amount: 14850,
      status: "paid",
      created_at: "2026-09-30T10:00:00.000Z",
    },
  ],
  seller_exports: [
    {
      id: "exp-1",
      seller_id: "seller-001",
      type: "orders_monthly",
      format: "csv",
      status: "completed",
      created_at: "2026-10-01T00:00:00.000Z",
    },
  ],
};
