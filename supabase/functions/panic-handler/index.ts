import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  const { record } = await req.json();

  if (record.type !== 'panic') {
    return new Response(JSON.stringify({ message: 'Not a panic alert' }), { status: 200 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1. Fetch all users with a push token
  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id, expo_push_token, location_lat, location_lng, full_name')
    .not('expo_push_token', 'is', null);

  if (error) return new Response(JSON.stringify(error), { status: 500 });

  const notifications = [];

  for (const user of users) {
    if (!user.expo_push_token) continue;

    // Calculate distance if both have coordinates
    let shouldNotify = false;
    if (user.id === record.user_id) {
       shouldNotify = true; // Notify the user themselves
    } else if (record.location_lat && record.location_lng && user.location_lat && user.location_lng) {
       const dist = getDistance(
         record.location_lat, record.location_lng,
         user.location_lat, user.location_lng
       );
       if (dist <= 300) shouldNotify = true;
    }

    if (shouldNotify) {
      notifications.push({
        to: user.expo_push_token,
        sound: 'default',
        title: user.id === record.user_id ? '🚨 SEU ALERTA FOI ENVIADO!' : '🚨 EMERGÊNCIA PRÓXIMA!',
        body: user.id === record.user_id 
          ? 'Vizinhos num raio de 300m foram notificados.'
          : `${record.metadata?.full_name || 'Um vizinho'} está pedindo socorro perto de você!`,
        data: { alertId: record.id },
        priority: 'high',
      });
    }
  }

  // 2. Send to Expo
  if (notifications.length > 0) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifications),
    });
  }

  return new Response(JSON.stringify({ sent: notifications.length }), { status: 200 });
});

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; 
}
