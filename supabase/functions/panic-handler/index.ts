import { serve } from "https://deno.land/std@0.131.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

serve(async (req) => {
  const { record } = await req.json();

  if (record.type !== 'panic' && record.type !== 'warning') {
    return new Response(JSON.stringify({ message: 'Not a relevant alert type' }), { status: 200 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 1. Fetch all users within a reasonable bound or just all users if the list is small enough
  // For production, a spatial query (PostGIS) would be better, but we'll stick to the logic provided or use a simple bounding box.
  const { data: users, error } = await supabaseAdmin
    .from('profiles')
    .select('id, location_lat, location_lng, full_name')
    .not('location_lat', 'is', null);

  if (error) return new Response(JSON.stringify(error), { status: 500 });

  const externalIds: string[] = [];
  const radius = record.type === 'panic' ? 500 : 1000; // 500m for panic, 1km for warnings

  for (const user of users) {
    if (user.id === record.user_id) continue; // Don't notify the sender here (app handles it)

    if (record.location_lat && record.location_lng && user.location_lat && user.location_lng) {
      const dist = getDistance(
        record.location_lat, record.location_lng,
        user.location_lat, user.location_lng
      );
      
      if (dist <= radius) {
        externalIds.push(user.id);
      }
    }
  }

  if (externalIds.length === 0) {
    return new Response(JSON.stringify({ message: 'No users nearby' }), { status: 200 });
  }

  // 2. Send to OneSignal
  const notificationTitle = record.type === 'panic' ? '🚨 EMERGÊNCIA PRÓXIMA!' : '⚠️ OCORRÊNCIA PRÓXIMA!';
  const notificationBody = record.type === 'panic' 
    ? `${record.metadata?.full_name || 'Um vizinho'} está pedindo socorro perto de você!`
    : `${record.metadata?.full_name || 'Um vizinho'} relatou: ${record.description || 'Alerta de segurança'}`;

  const onesignalRes = await fetch("https://onesignal.com/api/v1/notifications", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: externalIds,
      headings: { pt: notificationTitle, en: notificationTitle },
      contents: { pt: notificationBody, en: notificationBody },
      data: { 
        alertId: record.id, 
        type: record.type,
        screen: 'IncidentChat'
      },
      priority: 10, // High priority
      android_channel_id: record.type === 'panic' ? "emergency" : "default" // If they set up channels
    }),
  });

  const onesignalData = await onesignalRes.json();

  return new Response(JSON.stringify({ 
    sent_count: externalIds.length, 
    onesignal: onesignalData 
  }), { status: 200 });
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
