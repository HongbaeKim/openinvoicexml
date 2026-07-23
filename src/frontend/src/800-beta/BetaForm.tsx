import { useState, type FormEvent, type JSX } from "react";
import { submitBetaSignup } from "../000-core/api";
import { useTranslation } from "../000-core/i18n";
import { betaFormDict } from "./BetaForm.i18n";

type MessageState = { text: string; kind: "success" | "error" } | null;

const FIELD_INPUT_CLASS =
  "w-full rounded-md border border-border bg-bg px-[0.7rem] py-[0.6rem] text-text";
const FIELD_LABEL_CLASS = "mb-[0.35rem] block text-[0.85rem] text-text-muted";

export function BetaForm(): JSX.Element {
  const { t } = useTranslation(betaFormDict);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [role, setRole] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);
    const roleValue = (data.get("role") as string | null) ?? "";

    const payload = {
      name: (data.get("name") as string | null)?.trim() ?? "",
      email: (data.get("email") as string | null)?.trim() ?? "",
      consent: data.get("consent") === "on",
      role: roleValue,
      roleOther:
        roleValue === "other" ? ((data.get("roleOther") as string | null)?.trim() ?? "") : "",
      message: (data.get("message") as string | null)?.trim() ?? "",
      wantsContact: data.get("wantsContact") === "on",
      website: (data.get("website") as string | null) ?? "",
    };

    if (!payload.consent) {
      setMessage({ kind: "error", text: t.consentRequiredError });
      return;
    }

    setSubmitting(true);
    try {
      const { ok, result } = await submitBetaSignup(payload);
      if (ok) {
        form.reset();
        setRole("");
        setMessage({
          kind: "success",
          text: result.status === "already_signed_up" ? t.alreadySignedUp : t.success,
        });
      } else {
        setMessage({
          kind: "error",
          text: result.error ?? t.genericError,
        });
      }
    } catch {
      setMessage({ kind: "error", text: t.networkError });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-[10px] border border-border bg-surface p-5"
    >
      <div className="mb-4">
        <label className={FIELD_LABEL_CLASS} htmlFor="beta-name">
          <span aria-hidden="true" className="text-danger">
            *
          </span>{" "}
          {t.nameLabel}
        </label>
        <input
          className={FIELD_INPUT_CLASS}
          type="text"
          id="beta-name"
          name="name"
          required
          maxLength={200}
        />
      </div>
      <div className="mb-4">
        <label className={FIELD_LABEL_CLASS} htmlFor="beta-email">
          <span aria-hidden="true" className="text-danger">
            *
          </span>{" "}
          {t.emailLabel}
        </label>
        <input
          className={FIELD_INPUT_CLASS}
          type="email"
          id="beta-email"
          name="email"
          required
          maxLength={320}
        />
      </div>
      {/* Honeypot: hidden from real users via CSS. Bots that fill every field trip this;
          the server silently accepts without recording the signup. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="beta-website">Website</label>
        <input type="text" id="beta-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mb-4">
        <label className={FIELD_LABEL_CLASS} htmlFor="beta-role">
          <span aria-hidden="true" className="text-danger">
            *
          </span>{" "}
          {t.roleLabel}
        </label>
        <select
          className={FIELD_INPUT_CLASS}
          id="beta-role"
          name="role"
          required
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="" disabled></option>
          {t.roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {role === "other" && (
        <div className="mb-4">
          <label className={FIELD_LABEL_CLASS} htmlFor="beta-roleOther">
            {t.roleOtherLabel}
          </label>
          <input
            className={FIELD_INPUT_CLASS}
            type="text"
            id="beta-roleOther"
            name="roleOther"
            required
            maxLength={100}
            placeholder={t.roleOtherPlaceholder}
          />
        </div>
      )}

      <div className="mb-4">
        <label className={FIELD_LABEL_CLASS} htmlFor="beta-message">
          {t.messageLabel} <span className="text-text-muted">({t.optionalLabel})</span>
        </label>
        <textarea
          className={`${FIELD_INPUT_CLASS} min-h-[4.5rem] resize-y`}
          id="beta-message"
          name="message"
          maxLength={2000}
        />
      </div>

      <div className="mb-4 flex items-start gap-2">
        <input className="mt-[0.2rem]" type="checkbox" id="beta-wantsContact" name="wantsContact" />
        <label htmlFor="beta-wantsContact" className="text-sm text-text">
          {t.wantsContactLabel} <span className="text-text-muted">({t.optionalLabel})</span>
        </label>
      </div>

      <div className="mb-4 flex items-start gap-2">
        <input className="mt-[0.2rem]" type="checkbox" id="beta-consent" name="consent" />
        <label htmlFor="beta-consent" className="text-sm text-text">
          <span aria-hidden="true" className="text-danger">
            *
          </span>{" "}
          {t.consent.before}
          <a className="text-accent no-underline hover:underline" href="privacy.html">
            {t.consent.linkText}
          </a>
          {t.consent.after}
        </label>
      </div>

      <p className="mb-4 text-xs text-text-muted">{t.mandatoryLegend}</p>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-accent px-[1.4rem] py-[0.7rem] font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t.submit}
      </button>
      {message && (
        <p
          className={`mt-[0.9rem] text-sm ${message.kind === "success" ? "text-done" : "text-danger"}`}
          role="status"
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
