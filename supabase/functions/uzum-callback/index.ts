import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify Uzum signature using HMAC-SHA256
    const uzumSecret = Deno.env.get("UZUM_SECRET_KEY") ?? "";
    if (!uzumSecret) {
      console.error("UZUM_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Payment provider not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { order_id, transaction_id, status, amount, paid_at, sign_time, sign } = body;

    if (!order_id || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify signature: HMAC-SHA256(order_id + amount + sign_time, secret)
    const crypto = await import("https://deno.land/std@0.177.0/crypto/mod.ts");
    const encoder = new TextEncoder();
    const dataToSign = `${order_id}${amount}${sign_time || ""}`;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(uzumSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(dataToSign));
    const expectedSign = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (sign && sign !== expectedSign) {
      console.error("Uzum signature mismatch:", { order_id, expected: expectedSign, received: sign });
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total_amount, status")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.status === "paid" || order.status === "cancelled") {
      return new Response(
        JSON.stringify({ message: "Order already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (status === "paid") {
      await supabase
        .from("orders")
        .update({
          transaction_id: transaction_id || `uzum_${order_id}`,
          status: "paid",
          paid_at: paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);

      await supabase.from("audit_log").insert({
        admin_id: "system",
        action: "payment_callback",
        entity_type: "orders",
        entity_id: order_id,
        details: { provider: "uzum", transaction_id, amount },
      });
    } else if (status === "cancelled") {
      await supabase
        .from("orders")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order_id);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Uzum callback error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
