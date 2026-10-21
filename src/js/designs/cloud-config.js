/* ================= SHARED DESIGN LIST (Supabase) — pilot ================= */
// The Supabase project that holds the shared list: its URL and its publishable (anon) key. Both are
// meant to be public: the designs are guarded by sign-in and the members table (supabase/schema.sql),
// never by this key. Left empty, the tool shows no shared-list controls and works as before.
const CLOUD={ url:"", key:"" };
