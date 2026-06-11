const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM = process.env.ACCOUNT_EMAIL_FROM || "";
const EMAIL_REPLY_TO = process.env.ACCOUNT_EMAIL_REPLY_TO || "";
const ACCOUNT_APP_URL = process.env.ACCOUNT_APP_URL || "https://sierlia.github.io/testing3/#/settings/account";
const BATCH_LIMIT = Math.max(1, Math.min(Number(process.env.ACCOUNT_DELETION_BATCH_LIMIT || 50) || 50, 200));

function requireEnv(name, value) {
  if (!value) throw new Error(`${name} is required`);
}

function jsonHeaders(extra = {}) {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: jsonHeaders(options.headers),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.message || body?.error || text || response.statusText;
    throw new Error(`Supabase ${response.status}: ${message}`);
  }
  return body;
}

function formatDate(value) {
  if (!value) return "soon";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function messageFor(row) {
  const deleteAfter = row.payload?.delete_after;
  const cancelledAt = row.payload?.cancelled_at;
  const completedAt = row.payload?.completed_at;
  const changedAt = row.payload?.changed_at;
  if (row.event_type === "password_changed") {
    return {
      subject: "Gavel password changed",
      text: [
        "The password for your Gavel account was changed.",
        `Changed time: ${formatDate(changedAt)}`,
        "If you made this change, no action is needed.",
        `If you did not make this change, review your account immediately: ${ACCOUNT_APP_URL}`,
      ].join("\n\n"),
      html: `
        <p>The password for your Gavel account was changed.</p>
        <p><strong>Changed time:</strong> ${escapeHtml(formatDate(changedAt))}</p>
        <p>If you made this change, no action is needed.</p>
        <p>If you did not make this change, review your account immediately from <a href="${escapeHtml(ACCOUNT_APP_URL)}">Account Info</a>.</p>
      `,
    };
  }
  if (row.event_type === "account_deletion_requested") {
    return {
      subject: "Gavel account deletion scheduled",
      text: [
        "Your Gavel account has been scheduled for deletion.",
        `Deletion time: ${formatDate(deleteAfter)}`,
        `You can cancel this before the timer ends from Account Info: ${ACCOUNT_APP_URL}`,
      ].join("\n\n"),
      html: `
        <p>Your Gavel account has been scheduled for deletion.</p>
        <p><strong>Deletion time:</strong> ${escapeHtml(formatDate(deleteAfter))}</p>
        <p>You can cancel this before the timer ends from <a href="${escapeHtml(ACCOUNT_APP_URL)}">Account Info</a>.</p>
      `,
    };
  }
  if (row.event_type === "account_deletion_cancelled") {
    return {
      subject: "Gavel account deletion cancelled",
      text: `Your Gavel account deletion request was cancelled on ${formatDate(cancelledAt)}.`,
      html: `<p>Your Gavel account deletion request was cancelled on ${escapeHtml(formatDate(cancelledAt))}.</p>`,
    };
  }
  return {
    subject: "Gavel account deleted",
    text: `Your Gavel account was deleted on ${formatDate(completedAt)}.`,
    html: `<p>Your Gavel account was deleted on ${escapeHtml(formatDate(completedAt))}.</p>`,
  };
}

async function sendEmail(row) {
  const message = messageFor(row);
  const payload = {
    from: EMAIL_FROM,
    to: [row.recipient_email],
    subject: message.subject,
    text: message.text,
    html: message.html,
  };
  if (EMAIL_REPLY_TO) payload.reply_to = EMAIL_REPLY_TO;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const messageText = body?.message || body?.error || text || response.statusText;
    throw new Error(`Resend ${response.status}: ${messageText}`);
  }
  return body;
}

async function markQueueRow(tableName, id, patch) {
  await supabaseFetch(`/rest/v1/${tableName}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

async function updateRequestNoticeStatus(row, status) {
  if (row.event_type !== "account_deletion_requested" || !row.user_id) return;
  await supabaseFetch(`/rest/v1/account_deletion_requests?user_id=eq.${encodeURIComponent(row.user_id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ email_notice_status: status, updated_at: new Date().toISOString() }),
  });
}

async function main() {
  requireEnv("SUPABASE_URL or VITE_SUPABASE_URL", SUPABASE_URL);
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
  requireEnv("RESEND_API_KEY", RESEND_API_KEY);
  requireEnv("ACCOUNT_EMAIL_FROM", EMAIL_FROM);

  const deletedCount = await supabaseFetch("/rest/v1/rpc/process_due_account_deletions", {
    method: "POST",
    body: JSON.stringify({ batch_limit: BATCH_LIMIT }),
  });

  const queueRows = await supabaseFetch(
    `/rest/v1/account_deletion_email_queue?status=eq.queued&select=id,user_id,recipient_email,event_type,payload,created_at&order=created_at.asc&limit=${BATCH_LIMIT}`,
  );

  let sentCount = 0;
  let failedCount = 0;
  for (const row of queueRows) {
    try {
      if (!row.recipient_email) throw new Error("Missing recipient email");
      await sendEmail(row);
      await markQueueRow("account_deletion_email_queue", row.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        error_message: null,
      });
      await updateRequestNoticeStatus(row, "sent");
      sentCount += 1;
    } catch (error) {
      failedCount += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await markQueueRow("account_deletion_email_queue", row.id, {
        status: "failed",
        error_message: errorMessage.slice(0, 1000),
      });
      await updateRequestNoticeStatus(row, "failed");
      console.error(`Failed to send account deletion email ${row.id}: ${errorMessage}`);
    }
  }

  const securityQueueRows = await supabaseFetch(
    `/rest/v1/account_security_email_queue?status=eq.queued&select=id,user_id,recipient_email,event_type,payload,created_at&order=created_at.asc&limit=${BATCH_LIMIT}`,
  );

  let securitySentCount = 0;
  let securityFailedCount = 0;
  for (const row of securityQueueRows) {
    try {
      if (!row.recipient_email) throw new Error("Missing recipient email");
      await sendEmail(row);
      await markQueueRow("account_security_email_queue", row.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        error_message: null,
      });
      securitySentCount += 1;
    } catch (error) {
      securityFailedCount += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await markQueueRow("account_security_email_queue", row.id, {
        status: "failed",
        error_message: errorMessage.slice(0, 1000),
      });
      console.error(`Failed to send account security email ${row.id}: ${errorMessage}`);
    }
  }

  console.log(JSON.stringify({
    deletedCount,
    queuedDeletionEmails: queueRows.length,
    sentCount,
    failedCount,
    queuedSecurityEmails: securityQueueRows.length,
    securitySentCount,
    securityFailedCount,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
