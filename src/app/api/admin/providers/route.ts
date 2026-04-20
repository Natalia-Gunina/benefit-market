import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/api/auth";
import { success, created, withErrorHandling, parseBody } from "@/lib/api/response";
import { isDemo } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { unwrapSingle } from "@/lib/supabase/typed-queries";
import { z } from "zod";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/[а-яё]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const suffix = Date.now().toString(36);
  return base ? `${base}-${suffix}` : `provider-${suffix}`;
}

export function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDERS } = await import("@/lib/demo-data");
      return success(DEMO_PROVIDERS ?? []);
    }

    await requireRole("admin");
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "20", 10)));
    const offset = (page - 1) * perPage;

    let query = admin
      .from("providers")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);
    if (search) query = query.ilike("name", `%${search}%`);
    query = query.range(offset, offset + perPage - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return success({
      data: data ?? [],
      meta: { page, per_page: perPage, total: count ?? 0 },
    });
  }, "GET /api/admin/providers");
}

// ---------------------------------------------------------------------------
// POST /api/admin/providers — create a new provider
// ---------------------------------------------------------------------------

const createProviderSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional().default(""),
  contact_email: z.string().email().optional().or(z.literal("")).default(""),
  contact_phone: z.string().max(50).optional().or(z.literal("")).default(""),
  website: z.string().url().optional().or(z.literal("")).default(""),
  address: z.string().max(500).optional().or(z.literal("")).default(""),
});

export function POST(request: NextRequest) {
  return withErrorHandling(async () => {
    if (isDemo) {
      const { DEMO_PROVIDERS } = await import("@/lib/demo-data");
      const body = await request.json();
      const id = "demo-provider-" + Date.now().toString(36);
      const entry = {
        id,
        owner_user_id: "demo-user-001",
        name: body.name,
        slug: slugify(body.name),
        description: body.description ?? "",
        logo_url: null,
        website: body.website || null,
        contact_email: body.contact_email || "",
        contact_phone: body.contact_phone || null,
        address: body.address || null,
        status: "verified" as const,
        verified_at: new Date().toISOString(),
        verified_by: "demo-user-001",
        rejection_reason: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      DEMO_PROVIDERS.push(entry);
      return created(entry);
    }

    const appUser = await requireRole("admin");
    const admin = createAdminClient();
    const body = await request.json();
    const data = parseBody(createProviderSchema, body);

    const insertResult = await admin
      .from("providers")
      .insert({
        owner_user_id: appUser.id,
        name: data.name,
        slug: slugify(data.name),
        description: data.description,
        contact_email: data.contact_email,
        contact_phone: data.contact_phone || null,
        website: data.website || null,
        address: data.address || null,
        status: "verified",
        verified_at: new Date().toISOString(),
        verified_by: appUser.id,
      } as never)
      .select("*")
      .single();

    const row = unwrapSingle<{ id: string; name: string }>(
      insertResult,
      "Failed to create provider",
    );

    return created(row);
  }, "POST /api/admin/providers");
}
