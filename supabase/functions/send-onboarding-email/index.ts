// supabase/functions/send-onboarding-email/index.js
// JavaScript version (instead of TypeScript)
// Deploy: npx supabase functions deploy send-onboarding-email --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const {
      candidateName,
      personalEmail,
      workEmail,
      position,
      department,
      startDate,
    } = await req.json()

    console.log("📧 Email request received:", { candidateName, workEmail, personalEmail })

    // ── 1. Create auth user via Admin API (service role) ──────────
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const tempPassword = `Welcome${Math.floor(1000 + Math.random() * 9000)}!`

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: workEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: candidateName,
        role: "employee",
        avatar: candidateName.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(),
      },
    })

    if (authError) {
      console.warn("⚠️ Auth user creation warning:", authError.message)
    } else {
      console.log("✅ Auth user created:", authData?.user?.id)
    }

    // ── 2. Link candidate_id on their profile ────────────────────
    if (authData?.user) {
      const { data: candidate } = await supabaseAdmin
        .from("candidates")
        .select("id")
        .eq("work_email", workEmail)
        .single()

      if (candidate) {
        await supabaseAdmin
          .from("profiles")
          .update({ candidate_id: candidate.id })
          .eq("id", authData.user.id)
        console.log("✅ Profile linked to candidate:", candidate.id)
      }
    }

    // ── 3. Send welcome email via Resend ─────────────────────────
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
    const PORTAL_URL = Deno.env.get("PORTAL_URL") || "http://localhost:5173"
    const sendTo = personalEmail || workEmail

    console.log("📧 Attempting to send email to:", sendTo)
    console.log("🔑 RESEND_API_KEY present:", !!RESEND_API_KEY)
    console.log("🌐 PORTAL_URL:", PORTAL_URL)

    if (!RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY environment variable is not set!")
      return new Response(
        JSON.stringify({
          success: true,
          tempPassword,
          authUserId: authData?.user?.id,
          emailSent: false,
          error: "RESEND_API_KEY not configured"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#070B15;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0C1A1D;border:1px solid rgba(20,184,166,0.15);border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,rgba(20,184,166,0.15),rgba(6,182,212,0.05));padding:32px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.05);">
      <div style="display:inline-block;background:rgba(20,184,166,0.1);border:1px solid rgba(20,184,166,0.2);border-radius:12px;padding:12px 20px;margin-bottom:16px;">
        <span style="color:#2DD4BF;font-size:18px;font-weight:700;">D Company</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;">Welcome to the team, ${candidateName.split(" ")[0]}! 🎉</h1>
      <p style="color:#94A3B8;font-size:14px;margin:0;">You've been added as ${position} · ${department}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#CBD5E1;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Your onboarding portal is ready. Complete your documents and checklist before your start date${startDate ? ` on <strong style="color:#fff;">${new Date(startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>` : ""}.
      </p>

      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#64748B;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 12px;">Your Login Credentials</p>
        <div style="margin-bottom:8px;">
          <span style="color:#64748B;font-size:12px;">Work Email</span><br>
          <span style="color:#2DD4BF;font-size:14px;font-weight:600;">${workEmail}</span>
        </div>
        <div>
          <span style="color:#64748B;font-size:12px;">Temporary Password</span><br>
          <span style="color:#fff;font-size:16px;font-weight:700;letter-spacing:0.05em;">${tempPassword}</span>
        </div>
      </div>

      <a href="${PORTAL_URL}/onboarding" style="display:block;text-align:center;background:linear-gradient(135deg,#0D9488,#0891B2);color:#fff;font-size:14px;font-weight:700;padding:14px 24px;border-radius:10px;text-decoration:none;margin-bottom:24px;">
        Start Onboarding →
      </a>

      <p style="color:#475569;font-size:12px;line-height:1.5;margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,0.05);">
        🔒 Please change your password after your first login. If you have questions, contact <a href="mailto:hr@dcompany.com" style="color:#2DD4BF;">hr@dcompany.com</a>
      </p>
    </div>
  </div>
</body>
</html>`

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "D Company <onboarding@resend.dev>",
        to: [sendTo],
        subject: `Welcome to the team, ${candidateName.split(" ")[0]}! Your onboarding details inside`,
        html: emailHtml,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error("❌ Resend API error:", resendData)

      return new Response(
        JSON.stringify({
          success: true,
          tempPassword,
          authUserId: authData?.user?.id,
          emailSent: false,
          error: resendData.message || "Email delivery failed"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log("✅ Email sent successfully via Resend:", resendData.id)

    return new Response(
      JSON.stringify({
        success: true,
        tempPassword,
        authUserId: authData?.user?.id,
        emailSent: true,
        emailId: resendData.id
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("❌ Edge function error:", err)
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})