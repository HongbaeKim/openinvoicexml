import { Header } from "../100-layout/Header";
import { Footer } from "../100-layout/Footer";
import { BetaForm } from "./BetaForm";
import { useTranslation, usePageMeta } from "../000-core/i18n";
import { betaPageDict } from "./BetaPage.i18n";

export function BetaPage(): JSX.Element {
  const { t } = useTranslation(betaPageDict);
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
          <h2 className="mb-2 text-xl text-text">{t.howItWorksHeading}</h2>
          <p className="text-[1.05rem] text-text">{t.howItWorksBody}</p>
        </section>

        <section>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {t.benefits.map((benefit) => (
              <div key={benefit.title} className="rounded-[10px] border border-border bg-surface p-5">
                <h3 className="mb-1 text-lg text-text">{benefit.title}</h3>
                <p className="text-sm text-text-muted">{benefit.description}</p>
              </div>
            ))}
          </div>
          <BetaForm />
        </section>
      </main>

      <Footer />
    </>
  );
}
