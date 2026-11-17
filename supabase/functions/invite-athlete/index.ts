import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
const appUrl = "https://svteam.app/";
const allowedOrigins = new Set([
  "https://svteam.app",
  "https://sv-team-app-delta.vercel.app",
  "https://sv-team-app-assettemergaliyev.vercel.app",
  "https://sv-team-app-git-main-assettemergaliyev.vercel.app",
  "http://localhost:3000",
]);

const service = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function json(req: Request, payload: Record<string, unknown>, status = 200) {
  const origin = req.headers.get("origin") ?? "";
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  });
  if (allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "authorization, x-client-info, apikey, content-type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function failure(req: Request, status: number, code: string, message: string) {
  return json(req, { ok: false, code, error: message }, status);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return failure(req, 405, "METHOD_NOT_ALLOWED", "Метод не поддерживается.");
  if (!supabaseUrl || !serviceKey) return failure(req, 500, "SERVER_CONFIGURATION", "Сервис приглашений не настроен.");

  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return failure(req, 401, "UNAUTHORIZED", "Войди в аккаунт клуба.");

  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: authError } = await service.auth.getUser(token);
  const actor = userData.user;
  if (authError || !actor) return failure(req, 401, "UNAUTHORIZED", "Сессия истекла. Войди в приложение снова.");

  let body: Record<string, unknown>;
  try {
    const value = await req.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return failure(req, 400, "INVALID_BODY", "Проверь данные приглашения.");
    body = value as Record<string, unknown>;
  } catch {
    return failure(req, 400, "INVALID_BODY", "Проверь данные приглашения.");
  }

  if (body.action === "accept") {
    if (!actor.email) return failure(req, 400, "EMAIL_REQUIRED", "У аккаунта не указана почта.");
    const now = new Date().toISOString();
    const { data: invitation, error: findError } = await service.from("invitations")
      .select("id, club_id, athlete_id, email, accepted_at, revoked_at, expires_at")
      .eq("auth_invitation_reference", actor.id)
      .ilike("email", actor.email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", now)
      .maybeSingle();
    if (findError) return failure(req, 500, "INVITATION_LOOKUP_FAILED", "Не удалось проверить приглашение.");
    if (!invitation) return failure(req, 404, "INVITATION_NOT_FOUND", "Приглашение не найдено или уже истекло.");
    const { data: accepted, error: updateError } = await service.from("invitations")
      .update({ accepted_at: now, updated_at: now, updated_by: actor.id, revision: 2 })
      .eq("id", invitation.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle();
    if (updateError || !accepted) return failure(req, 500, "INVITATION_ACCEPT_FAILED", "Пароль сохранён, но приглашение не удалось подтвердить. Обратись к тренеру.");
    return json(req, { ok: true, accepted: true });
  }

  if (body.action !== "send") return failure(req, 400, "INVALID_ACTION", "Неизвестное действие.");
  const clubId = body.club_id;
  const athleteId = body.athlete_id;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isUuid(clubId) || !isUuid(athleteId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return failure(req, 400, "INVALID_INVITATION", "Проверь спортсмена и адрес электронной почты.");
  }

  const { data: member, error: memberError } = await service.from("club_users")
    .select("role, access_status")
    .eq("club_id", clubId)
    .eq("user_id", actor.id)
    .maybeSingle();
  if (memberError) return failure(req, 500, "ACCESS_CHECK_FAILED", "Не удалось проверить права доступа.");
  if (!member || member.access_status !== "ACTIVE" || !["ADMIN", "COACH"].includes(member.role)) {
    return failure(req, 403, "ACCESS_DENIED", "Приглашать спортсменов могут только тренер и администратор.");
  }

  const { data: athlete, error: athleteError } = await service.from("athletes")
    .select("id, first_name, last_name")
    .eq("club_id", clubId)
    .eq("id", athleteId)
    .maybeSingle();
  if (athleteError) return failure(req, 500, "ATHLETE_LOOKUP_FAILED", "Не удалось проверить карточку спортсмена.");
  if (!athlete) return failure(req, 404, "ATHLETE_NOT_FOUND", "Спортсмен не найден в этом клубе.");

  const { data: linkedAccount, error: linkCheckError } = await service.from("athlete_accounts")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("athlete_id", athleteId)
    .maybeSingle();
  if (linkCheckError) return failure(req, 500, "ACCOUNT_LOOKUP_FAILED", "Не удалось проверить аккаунт спортсмена.");
  if (linkedAccount) return failure(req, 409, "ATHLETE_ALREADY_LINKED", "К этой карточке спортсмена уже привязан аккаунт.");

  const { data: pending, error: pendingError } = await service.from("invitations")
    .select("id")
    .eq("club_id", clubId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();
  if (pendingError) return failure(req, 500, "INVITATION_LOOKUP_FAILED", "Не удалось проверить предыдущие приглашения.");
  if (pending) return failure(req, 409, "INVITATION_ALREADY_SENT", "Для этой почты уже есть активное приглашение.");

  const redirectTo = `${appUrl}?invite=1`;
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: [athlete.first_name, athlete.last_name].filter(Boolean).join(" ") },
  });
  if (inviteError || !invited.user) {
    return failure(req, 409, "EMAIL_UNAVAILABLE", "Не удалось пригласить этот адрес. Возможно, он уже зарегистрирован; проверь почту аккаунта или обратись к администратору.");
  }

  const inviteUserId = invited.user.id;
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const rollback = async () => {
    await service.from("invitations").delete().eq("auth_invitation_reference", inviteUserId).eq("club_id", clubId);
    await service.from("athlete_accounts").delete().eq("user_id", inviteUserId).eq("club_id", clubId);
    await service.from("club_users").delete().eq("user_id", inviteUserId).eq("club_id", clubId);
    await service.auth.admin.deleteUser(inviteUserId);
  };

  const { error: membershipError } = await service.from("club_users").insert({
    club_id: clubId,
    user_id: inviteUserId,
    role: "ATHLETE",
    access_status: "ACTIVE",
  });
  if (membershipError) {
    await rollback();
    return failure(req, 500, "MEMBERSHIP_CREATE_FAILED", "Письмо отправлено, но доступ спортсмена не удалось подготовить. Обратись к администратору.");
  }

  const { error: accountError } = await service.from("athlete_accounts").insert({
    club_id: clubId,
    athlete_id: athleteId,
    user_id: inviteUserId,
  });
  if (accountError) {
    await rollback();
    return failure(req, 500, "ACCOUNT_LINK_FAILED", "Письмо отправлено, но карточку спортсмена не удалось привязать. Обратись к администратору.");
  }

  const { data: savedInvitation, error: invitationError } = await service.from("invitations").insert({
    club_id: clubId,
    athlete_id: athleteId,
    intended_role: "ATHLETE",
    email,
    auth_invitation_reference: inviteUserId,
    created_by: actor.id,
    updated_by: actor.id,
    expires_at: expiresAt,
  }).select("id").single();
  if (invitationError || !savedInvitation) {
    await rollback();
    return failure(req, 500, "INVITATION_SAVE_FAILED", "Письмо отправлено, но приглашение не удалось записать. Обратись к администратору.");
  }

  return json(req, {
    ok: true,
    invitation_id: savedInvitation.id,
    athlete_name: [athlete.first_name, athlete.last_name].filter(Boolean).join(" "),
    email,
  });
});
