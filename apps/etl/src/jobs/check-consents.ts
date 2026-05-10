import { alerts, db, integrationCredentials } from "@cfo-ai/db";
import { and, eq, gt, isNotNull, lt, sql } from "drizzle-orm";

/**
 * Verifica consents próximos do vencimento (Pluggy / OFB tem renovação anual
 * obrigatória — 12 meses). Cria `alerts(kind='consent_expiring')` quando faltam
 * menos de 30 dias. Idempotente: não duplica alerta pra mesmo provider+account_link
 * dentro do mesmo ciclo.
 */

const WARNING_WINDOW_DAYS = 30;

export interface ConsentCheckSummary {
  scanned: number;
  alertsCreated: number;
  alertsSkipped: number;
}

export async function checkConsents(): Promise<ConsentCheckSummary> {
  const now = new Date();
  const threshold = new Date(
    now.getTime() + WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const expiring = await db
    .select()
    .from(integrationCredentials)
    .where(
      and(
        isNotNull(integrationCredentials.expiresAt),
        gt(integrationCredentials.expiresAt, now),
        lt(integrationCredentials.expiresAt, threshold),
      ),
    );

  let alertsCreated = 0;
  let alertsSkipped = 0;

  for (const cred of expiring) {
    const dueDate = cred.expiresAt!;
    const daysLeft = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Verifica se já existe alerta pendente pra esse provider+link cuja
    // data limite cai no mesmo dia (idempotência simples).
    const dueDateIso = dueDate.toISOString().slice(0, 10);
    const existing = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.kind, "consent_expiring"),
          sql`${alerts.context}->>'provider' = ${cred.provider}`,
          sql`${alerts.context}->>'account_link' = ${cred.accountLink ?? ""}`,
          sql`${alerts.context}->>'expires_at' = ${dueDateIso}`,
        ),
      );

    if (existing.length > 0) {
      alertsSkipped++;
      continue;
    }

    await db.insert(alerts).values({
      severity: daysLeft <= 7 ? "critical" : "warning",
      kind: "consent_expiring",
      title: `${cred.provider} consent expira em ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`,
      bodyMd: [
        `O consent do **${cred.provider}** (${cred.accountLink ?? "?"}) expira em **${dueDateIso}** (${daysLeft} dias).`,
        "",
        "Reconecte em [/connect](/connect) pra evitar interrupção da sincronização.",
      ].join("\n"),
      context: {
        provider: cred.provider,
        account_link: cred.accountLink,
        expires_at: dueDateIso,
        credential_id: cred.id,
      },
    });
    alertsCreated++;
  }

  return {
    scanned: expiring.length,
    alertsCreated,
    alertsSkipped,
  };
}
