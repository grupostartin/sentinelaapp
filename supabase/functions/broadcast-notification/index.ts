import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Request Method:', req.method);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('Auth Header present:', !!authHeader);

    const { title, body } = await req.json();
    console.log('Sending broadcast:', title);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('expo_push_token')
      .not('expo_push_token', 'is', null);

    if (error) throw error;

    const notifications = users
      .filter(u => u.expo_push_token)
      .map(user => ({
        to: user.expo_push_token,
        sound: 'default',
        title: title,
        body: body,
        priority: 'high',
      }));

    const chunks = [];
    for (let i = 0; i < notifications.length; i += 100) {
      chunks.push(notifications.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
    }

    return new Response(JSON.stringify({ sent: notifications.length }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (err: any) {
    console.error('Broadcast error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, // Changed to 400 for better client handling
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
