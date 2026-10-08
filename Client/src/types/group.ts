/* ───────────────────────────────────────────────────────────────────────────
   Group / contact-list domain types
─────────────────────────────────────────────────────────────────────────── */
export interface GroupMember {
  _id: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  contactCount?: number;
  members?: GroupMember[];
  createdAt?: string;
}
