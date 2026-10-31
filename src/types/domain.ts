export type { LocationUpdate } from "@/shared/core/delivery";
import type { TableRow } from "@/shared/database";

export type PartnerRow = TableRow<"delivery_partners">;

/** Fields used by the partner dashboard. KYC and payout secrets are excluded. */
export type SafePartner = Pick<
  PartnerRow,
  | "id"
  | "user_id"
  | "full_name"
  | "mobile"
  | "email"
  | "mobile_verified"
  | "email_verified"
  | "profile_photo_url"
  | "date_of_birth"
  | "gender"
  | "emergency_contact_number"
  | "house_number"
  | "street"
  | "area"
  | "city"
  | "state"
  | "pincode"
  | "vehicle_type"
  | "vehicle_number"
  | "vehicle_brand"
  | "vehicle_model"
  | "vehicle_color"
  | "employment_type"
  | "status"
  | "admin_note"
  | "registration_step"
  | "availability"
  | "current_latitude"
  | "current_longitude"
  | "location_updated_at"
  | "rating"
  | "total_deliveries"
  | "cancelled_deliveries"
  | "late_deliveries"
  | "total_requests"
  | "accepted_requests"
  | "approved_at"
  | "created_at"
>;
