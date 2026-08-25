/** API DTOs mirroring the DRF serializers. */

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  preferred_language: "en" | "bn";
  avatar: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo: string | null;
  cover_image: string | null;
  phone: string;
  email: string;
  address_line: string;
  area: string;
  upazila: string;
  district: string;
  division: string;
  currency: string;
  default_language: "en" | "bn";
  opening_time: string | null;
  closing_time: string | null;
  status: "active" | "suspended" | "closed";
}

export interface LocalizedName {
  name_en: string;
  name_bn: string;
}

export type TableStatus =
  | "available"
  | "occupied"
  | "awaiting_order"
  | "order_received"
  | "preparing"
  | "ready"
  | "awaiting_service"
  | "served"
  | "awaiting_payment"
  | "reserved"
  | "attention"
  | "offline";

export interface Table {
  id: string;
  number: string;
  label: string;
  seats: number;
  floor: string;
  status: TableStatus;
  active_orders: number;
  has_new_orders: number;
  guests: number;
  grid_x: number | null;
  grid_y: number | null;
  grid_w: number;
  grid_h: number;
  seated_at: string | null;
  dining_minutes: number | null;
  version: number;
  /** Live unpaid total across the table's open orders (optional). */
  total?: string | number | null;
  qr_code?: QRCodeInfo | null;
}

export interface QRCodeInfo {
  id: string;
  token: string;
  order_url: string;
  image_data_uri?: string;
}

export interface DishVariant extends LocalizedName {
  id: string;
  price_delta: string;
  is_default: boolean;
  display_order: number;
}

export interface DishModifier extends LocalizedName {
  id: string;
  price_delta: string;
  is_available: boolean;
  is_default: boolean;
  display_order: number;
  group: string | null;
}

export interface ModifierGroup {
  id: string;
  name_en: string;
  name_bn: string;
  min_selections: number;
  max_selections: number;
  is_active: boolean;
  display_order: number;
  options: DishModifier[];
}

export interface Dish extends LocalizedName {
  id: string;
  description_en: string;
  description_bn: string;
  price: string;
  image: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_vegetarian: boolean;
  is_spicy: boolean;
  min_prep_time: number;
  max_prep_time: number;
  category: string;
  variants: DishVariant[];
  modifiers: DishModifier[];
  modifier_groups: ModifierGroup[];
}

export interface MenuCategory extends LocalizedName {
  id: string;
  dishes: Dish[];
}

export interface Menu extends LocalizedName {
  id: string;
  is_active: boolean;
  categories: MenuCategory[];
}

export type OrderStatus =
  | "NEW"
  | "ACCEPTED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

export interface OrderItem {
  id: string;
  dish_name_en: string;
  dish_name_bn: string;
  dish_image: string;
  min_prep_time: number;
  max_prep_time: number;
  variant_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
  special_instructions: string;
  selected_modifiers: Array<{
    id: string;
    name_en: string;
    name_bn: string;
    price_delta: string;
  }>;
  modifier_total: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  order_type: "dine_in" | "take_away";
  table: string;
  table_label?: string;
  customer_note: string;
  subtotal: string;
  total: string;
  items: OrderItem[];
  created_at: string;
}

export interface SubscriptionPlan extends LocalizedName {
  id: string;
  code: string;
  description_en: string;
  description_bn: string;
  price: string;
  interval: "monthly" | "yearly";
  trial_days: number;
  max_tables: number;
  max_staff: number;
  max_dishes: number;
  has_analytics: boolean;
}

export interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  status: "trialing" | "active" | "past_due" | "expired" | "cancelled";
  trial_ends_at: string | null;
  current_period_end: string | null;
  is_entitled: boolean;
}

export interface AnalyticsOverview {
  date: string;
  orders_total: number;
  orders_by_status: Record<string, number>;
  revenue_paid: string;
  tables_by_status: Record<string, number>;
}

export interface EnhancedOverview {
  date: string;
  orders_total: number;
  orders_delta_pct: number | null;
  revenue_today: string;
  revenue_yesterday: string;
  revenue_last_week: string;
  revenue_vs_yesterday_pct: number | null;
  revenue_vs_last_week_pct: number | null;
  customers_today: number;
  table_occupancy_pct: number;
  occupied_tables: number;
  total_tables: number;
  avg_prep_time_min: number;
  avg_prep_time_max: number;
  avg_order_value: string;
  repeat_customer_pct: number;
  best_sellers: Array<{ dish: string; dish_bn: string; quantity: number; revenue: string }>;
  declining_items: Array<{ dish: string; last_week: number; this_week: number; change_pct: number }>;
  order_type_mix: { dine_in: number; take_away: number };
}

export interface AiInsight {
  type: string;
  icon: string;
  title: string;
  body: string;
  recommendation: string;
}

export interface DemandForecast {
  date: string;
  weekday: string;
  expected_orders: number;
  lunch_peak: { start: string; end: string; orders: number };
  dinner_peak: { start: string; end: string; orders: number };
  recommended_kitchen_staff: number;
  top_items_forecast: Array<{ dish: string; expected_qty: number }>;
  confidence: string;
}

export interface MenuEngineeringItem {
  dish: string;
  dish_bn: string;
  quantity: number;
  revenue: string;
  price: string;
  category: "stars" | "plow_horses" | "puzzles" | "dogs";
}

export interface MenuEngineering {
  stars: MenuEngineeringItem[];
  plow_horses: MenuEngineeringItem[];
  puzzles: MenuEngineeringItem[];
  dogs: MenuEngineeringItem[];
}

export interface TableIntelligenceTable {
  id: string;
  number: string;
  label: string;
  seats: number;
  floor: string;
  status: string;
  current_order?: {
    order_number: string;
    total: string;
    status: string;
    elapsed_minutes: number;
    order_type: string;
  };
  turnovers_today: number;
}

export interface TableIntelligence {
  total_tables: number;
  occupied: number;
  available: number;
  occupancy_pct: number;
  avg_turnover_minutes: number;
  tables: TableIntelligenceTable[];
}

export interface OrdersOverTimePoint {
  date: string;
  orders: number;
  revenue: string;
}

export interface PopularDish {
  dish: string;
  quantity: number;
  revenue: string;
}

export interface PeakHour {
  hour: string;
  orders: number;
}

export interface NotificationItem {
  id: string;
  kind: "new_order" | "order_status" | "table_alert" | "system";
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Offer {
  id: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  dish: string | null;
  dish_name: string | null;
  dish_image: string | null;
  dish_price: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  created_at: string;
}

export interface ApiError {
  code: string;
  message: string;
  errors?: Record<string, string[]>;
}

/** Structured plan-gating error returned by the backend when a feature
 * is not available on the restaurant's current subscription plan. */
export const PLAN_UPGRADE_REQUIRED = "plan_upgrade_required";

export function isPlanUpgradeRequired(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as ApiError).code === PLAN_UPGRADE_REQUIRED
  );
}

export interface Role {
  id: string;
  name_en: string;
  name_bn: string;
  slug: string;
  is_system: boolean;
}

export interface Membership {
  id: string;
  user_email: string;
  role: string | null;
  role_name: string | null;
  is_owner: boolean;
  is_active: boolean;
  created_at: string;
  branches: Array<{ id: string; name: string }>;
}
