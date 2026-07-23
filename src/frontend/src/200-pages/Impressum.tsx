import type { JSX } from "react";
import { Header } from "../100-layout/Header";
import { Footer } from "../100-layout/Footer";
import { useTranslation, usePageMeta } from "../000-core/i18n";
import { impressumDict } from "./Impressum.i18n";

export function Impressum(): JSX.Element {
  const { t } = useTranslation(impressumDict);
  usePageMeta({ title: t.metaTitle, description: t.metaDescription });

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[720px] space-y-14 px-5 pt-12 pb-20">
        <section>
          <h1 className="mb-3 text-[2.1rem] leading-[1.25] text-text">{t.heading}</h1>
          {/* Legal citation of German law — stays in German regardless of the active language. */}
          <p className="text-[1.05rem] text-text">
            Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.responsibleHeading}</h2>
          <p>
            Hongbae Kim
            <br />
            Guerickestraße 10
            <br />
            10587, Berlin
            <br />
            Germany
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.contactHeading}</h2>
          <p>
            {t.emailLabel}{" "}
            <a
              className="text-accent no-underline hover:underline"
              href="mailto:contact@openinvoicexml.de"
            >
              contact@openinvoicexml.de
            </a>
            <br />
            +49 15734727901
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-xl text-text">{t.fundingHeading}</h2>
          <p>
            {t.funding.before}
            <a
              className="text-accent no-underline hover:underline"
              href="https://www.prototypefund.de/projects/openinvoicexml"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.funding.linkText}
            </a>
            {t.funding.after}
          </p>
        </section>
      </main>

      <Footer />
    </>
  );
}
