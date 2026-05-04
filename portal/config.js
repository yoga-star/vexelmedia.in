// =====================================================================
// SUPABASE CONFIG — replace these two values from your Supabase project
// (Project Settings → API)
// =====================================================================
export const SUPABASE_URL = 'YOUR_SUPABASE_URL';        // e.g. https://abcdefg.supabase.co
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Storage bucket name — leave as-is unless you renamed the bucket
export const STORAGE_BUCKET = 'task-files';

// Status labels and colors (used across portal UI)
export const STATUS = {
  submitted:   { label: 'Submitted',     color: '#8a857a' },
  in_progress: { label: 'In progress',   color: '#d4ff3e' },
  review:      { label: 'Ready for review', color: '#ff6b3d' },
  revisions:   { label: 'Revisions',     color: '#ff6b3d' },
  delivered:   { label: 'Delivered',     color: '#25d366' },
};
