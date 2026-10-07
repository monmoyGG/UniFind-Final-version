/** Shapes returned by the FastAPI backend. Field names match the API exactly. */

export type ItemType = "lost" | "found";
export type ItemStatus = "open" | "pending" | "resolved";
export type ClaimStatus = "submitted" | "approved" | "rejected";
export type SortOrder = "recent" | "oldest";

export type User = {
  id: number;
  name: string;
  email: string;
  department: string | null;
  role: "user" | "admin";
  /** False until the member enters the code sent to their UIU address. */
  is_verified: boolean;
  created_at: string;
};

/** Who the confirmation screen is waiting on, read back from the pending cookie. */
export type Pending = {
  name: string;
  email: string;
  expires_in_minutes: number;
};

export type Verification = {
  /** False when the backend has no SMTP server — the code went to its console. */
  sent: boolean;
  email: string;
  expires_in_minutes: number;
  /** Development only. Never present when the backend runs in production. */
  dev_code: string | null;
};

export type Item = {
  id: number;
  owner_id: number;
  owner_name: string;
  type: ItemType;
  status: ItemStatus;
  title: string;
  category: string;
  description: string;
  location: string;
  date_lost_found: string;
  image_url: string | null;
  brand: string | null;
  color: string | null;
  model: string | null;
  /** Only ever sent to the member who posted the item. */
  identifying_details: string | null;
  is_removed: boolean;
  created_at: string;
  updated_at: string;
};

export type ClaimQuestion = {
  id: number;
  prompt: string;
  options: string[];
};

export type ClaimQuestionDraft = Omit<ClaimQuestion, "id"> & {
  correct_option: number;
};

export type ClaimAnswer = {
  question_id: number;
  selected_option: number;
};

export type Claim = {
  verification_result: { correct: number; total: number } | null;
  id: number;
  item_id: number;
  claimant_id: number;
  claimant_name: string;
  verification_message: string;
  status: ClaimStatus;
  direction: "sent" | "received";
  item: Item;
  created_at: string;
};

export type Comment = {
  id: number;
  item_id: number;
  author_id: number;
  author_name: string;
  body: string;
  created_at: string;
};

export type Match = {
  id: number;
  score: number;
  reasons: string[];
  own_item: Item;
  matched_item: Item;
};

export type Message = {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  body: string;
  created_at: string;
};

export type Conversation = {
  id: number;
  item: Item;
  other_participant_id: number;
  other_participant_name: string;
  last_message: Message | null;
  updated_at: string;
};

export type ConversationDetail = {
  id: number;
  item: Item;
  other_participant_id: number;
  other_participant_name: string;
  messages: Message[];
};

export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  is_read: boolean;
  created_at: string;
};

export type Dashboard = {
  counts: {
    active_posts: number;
    possible_matches: number;
    pending_claims: number;
    resolved_cases: number;
  };
  recent_items: Item[];
  recent_activity: Notification[];
};

export type PublicStats = {
  active_reports: number;
  possible_matches: number;
  items_reunited: number;
};

export type AdminStats = {
  active_posts: number;
  lost_posts: number;
  found_posts: number;
  pending_moderation: number;
  resolved_cases: number;
  total_users: number;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  department: string | null;
  role: string;
  is_suspended: boolean;
  item_count: number;
  created_at: string;
};

export type ContentReport = {
  id: number;
  reporter_id: number;
  reporter_name: string;
  target_type: string;
  target_id: number;
  reason: string;
  status: string;
  created_at: string;
};

export type ItemFilters = {
  search?: string;
  type?: ItemType;
  category?: string;
  location?: string;
  status?: ItemStatus;
  mine?: boolean;
  sort?: SortOrder;
};
