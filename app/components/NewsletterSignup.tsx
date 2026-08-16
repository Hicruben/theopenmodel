"use client";
import { useState } from "react";

// Kit (formerly ConvertKit) hosts the list. Set this to the form's numeric id from
// Kit → Grow → Landing Pages & Forms → your form → the id in its URL.
const KIT_FORM_ID = process.env.NEXT_PUBLIC_KIT_FORM_ID ?? "";
const ACTION = `https://app.kit.com/forms/${KIT_FORM_ID}/subscriptions`;

type State = "idle" | "sending" | "done" | "error";

// A real <form> that posts to Kit, enhanced with fetch when JS is available so the
// reader stays on the page. Without JS it still submits normally — no subscriber is
// lost to a script that failed to load.
export function NewsletterSignup({
  source,
  title = "Get the model's week in one email",
  blurb = "Every Tuesday: the biggest probability swing of the week, one chart, and the prediction the model got most wrong. No betting tips, no spam, unsubscribe in one click.",
  compact = false,
}: {
  source: string;
  title?: string;
  blurb?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<State>("idle");

  // Without a configured form the action URL is malformed and every submission would be
  // silently discarded. Showing nothing is far better than collecting addresses into a
  // void — someone who subscribes once and never hears back does not subscribe twice.
  if (!KIT_FORM_ID) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!KIT_FORM_ID) return;                 // no form configured: fall through to a normal post
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setState("sending");
    try {
      const res = await fetch(ACTION, { method: "POST", body: data, headers: { accept: "application/json" } });
      setState(res.ok ? "done" : "error");
      if (res.ok) form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className={`signup${compact ? " compact" : ""}`} role="status">
        <p className="signup-done">
          <b>Check your inbox.</b> Confirm the subscription and the next issue will arrive on Tuesday.
        </p>
      </div>
    );
  }

  return (
    <div className={`signup${compact ? " compact" : ""}`}>
      {!compact && <h2 className="signup-title">{title}</h2>}
      <p className="signup-blurb">{blurb}</p>
      <form className="signup-form" action={ACTION} method="post" onSubmit={onSubmit}>
        <label className="visually-hidden" htmlFor={`email-${source}`}>Email address</label>
        <input
          id={`email-${source}`}
          type="email"
          name="email_address"
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={state === "sending"}
        />
        {/* Records which placement earned the subscriber, so we can tell what works. */}
        <input type="hidden" name="fields[source]" value={source} />
        <button type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Subscribing…" : "Subscribe"}
        </button>
      </form>
      {state === "error" && (
        <p className="signup-error">That didn&apos;t go through. Please try again in a moment.</p>
      )}
      <p className="signup-fine">
        Free. One email a week. We never share the address, and every issue has an unsubscribe link.
      </p>
    </div>
  );
}
