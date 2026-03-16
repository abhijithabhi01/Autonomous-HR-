// supabase/functions/gemini-proxy/index.ts
// Vertex AI Gemini proxy - keeps service account JSON server-side
//
// DEPLOY:
//   supabase functions deploy gemini-proxy --no-verify-jwt
//
// SECRETS (set once):
//   supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
//   supabase secrets set VERTEX_REGION=us-central1   (optional, default us-central1)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

// ---- Google service account -> access token -----------------
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "")
  const binary = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )
}

function b64url(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
  let s = ""
  bytes.forEach((b) => (s += String.fromCharCode(b)))
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const now     = Math.floor(Date.now() / 1000)
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = b64url(
    JSON.stringify({
      iss:   sa.client_email,
      sub:   sa.client_email,
      aud:   "https://oauth2.googleapis.com/token",
      iat:   now,
      exp:   now + 3600,
      scope: "https://www.googleapis.com/auth/cloud-platform",
    })
  )
  const input      = header + "." + payload
  const privateKey = await importPrivateKey(sa.private_key)
  const sigBytes   = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(input)
  )
  const jwt = input + "." + b64url(new Uint8Array(sigBytes))

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  })
  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error("Token exchange failed: " + err)
  }
  const td = await tokenRes.json()
  if (!td.access_token) throw new Error("No access_token: " + JSON.stringify(td))
  return td.access_token
}

// ---- Vertex AI call -----------------------------------------
async function callVertex(
  token: string,
  projectId: string,
  requestBody: unknown
): Promise<string> {
  // gemini-2.0-flash-001 is the stable Vertex AI model
  // gemini-2.5-flash requires billing enabled + model access in GCP console
  const MODEL = "gemini-2.5-flash"

  // Global endpoint required for Gemini 2.0+ on Vertex AI
  const url =
    "https://aiplatform.googleapis.com/v1/projects/" +
    projectId +
    "/locations/global/publishers/google/models/" +
    MODEL +
    ":generateContent"

  console.log("[vertex] POST", url)

  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": "Bearer " + token,
    },
    body: JSON.stringify(requestBody),
  })

  // Always read full error body for debugging
  const rawBody = await res.text()
  console.log("[vertex] status:", res.status, "body:", rawBody.slice(0, 500))

  if (!res.ok) {
    throw new Error("Vertex AI " + res.status + ": " + rawBody)
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(rawBody)
  } catch (_) {
    throw new Error("Vertex AI non-JSON response: " + rawBody.slice(0, 200))
  }

  const text =
    (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error("Gemini returned empty content. Response: " + rawBody.slice(0, 300))
  }
  return text
}

// ---- Main handler -------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  try {
    const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if (!saJson) return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON secret not set" }, 500)

    let sa: Record<string, string>
    try {
      sa = JSON.parse(saJson)
    } catch (_) {
      return json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON" }, 500)
    }

    const projectId = sa.project_id
    if (!projectId) return json({ error: "project_id missing from service account JSON" }, 500)

    let body: { type?: string; prompt?: string; base64?: string; mimeType?: string }
    try {
      body = await req.json()
    } catch (_) {
      return json({ error: "Request body must be JSON" }, 400)
    }

    const { type, prompt, base64, mimeType } = body
    if (!prompt) return json({ error: "Missing required field: prompt" }, 400)

    const accessToken = await getAccessToken(sa)

    let geminiBody: unknown

    if (type === "vision" && base64 && mimeType) {
      // Vertex AI REST API uses camelCase: inlineData (not inline_data)
      // and requires role: "user" on the content object
      geminiBody = {
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data:     base64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature:     0.1,
          maxOutputTokens: 800,
        },
      }
    } else {
      geminiBody = {
        contents: [{
          role:  "user",
          parts: [{ text: prompt }],
        }],
        generationConfig: {
          temperature:     0.3,
          maxOutputTokens: 1024,
        },
      }
    }

    const text = await callVertex(accessToken, projectId, geminiBody)
    return json({ text })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[gemini-proxy] Error:", msg)
    // Return full error so frontend can show it
    return json({ error: msg }, 500)
  }
})