import type { JSX } from "react";
import { Header } from "../100-layout/Header";
import { Footer } from "../100-layout/Footer";
import { useTranslation, usePageMeta } from "../000-core/i18n";
import { privacyDict } from "./Privacy.i18n";

export function Privacy(): JSX.Element {
  const { t } = useTranslation(privacyDict);
  usePageMeta({ title: t.metaTitle, description: t.metaDescription });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[720px] space-y-14 px-5 pt-12 pb-20">
        <section>
          <h1 className="mb-3 text-[2.1rem] leading-[1.25] text-text">{t.heading}</h1>
          <p className="text-[1.05rem] text-text">{t.intro}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.whoResponsibleHeading}</h2>
          <p>
            {t.whoResponsible.before}
            <a className="text-accent no-underline hover:underline" href="impressum.html">
              {t.whoResponsible.linkText}
            </a>{" "}
            {t.whoResponsible.after}{" "}
            <a
              className="text-accent no-underline hover:underline"
              href="mailto:contact@openinvoicexml.de"
            >
              {t.whoResponsible.email}
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.whatWeCollectHeading}</h2>
          <p className="mb-3">{t.betaSignup}</p>
          <p>{t.developerFeedback}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.whyHeading}</h2>
          <p>
            {t.why.before}
            <a
              className="text-accent no-underline hover:underline"
              href="mailto:contact@openinvoicexml.de"
            >
              {t.why.email}
            </a>
            {t.why.after}
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.whereStoredHeading}</h2>
          <p>{t.whereStored}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.howLongHeading}</h2>
          <p>{t.howLong}</p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.yourRightsHeading}</h2>
          <p>{t.rightsIntro}</p>
          <ul className="mb-4 list-disc space-y-1 pl-5 text-text-muted">
            {t.rights.map((right) => (
              <li key={right}>{right}</li>
            ))}
          </ul>
          <p>
            {t.exerciseRights.before}
            <a
              className="text-accent no-underline hover:underline"
              href="mailto:contact@openinvoicexml.de"
            >
              {t.exerciseRights.email}
            </a>
            {t.exerciseRights.after}
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
