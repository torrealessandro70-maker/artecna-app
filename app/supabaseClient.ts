import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://axuiaiglbahygsmeoypy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4dWlhaWdsYmFoeWdzbWVveXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTY5ODYsImV4cCI6MjA5MjE3Mjk4Nn0.UU0rZN-8utUUXiuQHfkh-Z9sbhNmfpnJBsGMBqhzSIg'
)