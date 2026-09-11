import type { JSX } from "react";
import { useTranslation } from "../000-core/i18n";
import { footerDict } from "./footer.i18n";

export function Footer(): JSX.Element {
  const { t, lang } = useTranslation(footerDict);

  return (
    <footer className="w-full border-t border-border px-5 pt-8 pb-10 text-[0.85rem]">
      <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
        <div>
          <a
            href="index.html"
            className="inline-flex items-center gap-2 text-sm font-semibold text-text no-underline hover:underline"
          >
            <img src="/logo/OIX.png" alt="" className="h-6 w-6 rounded-full" />
            OpenInvoiceXML
          </a>
          <ul className="mt-3 list-none space-y-1.5 p-0">
            <li>
              <a
                className="text-text-muted no-underline hover:underline"
                href="https://www.prototypefund.de/projects/openinvoicexml"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.project}
              </a>
            </li>
            <li>
              <a
                className="text-text-muted no-underline hover:underline"
                href="https://github.com/HongbaeKim/openinvoicexml/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.license}
              </a>
            </li>
            <li>
              <a
                className="text-text-muted no-underline hover:underline"
                href="https://github.com/HongbaeKim/openinvoicexml"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.github}
              </a>
            </li>
            <li>
              <a className="text-text-muted no-underline hover:underline" href="privacy.html">
                {t.privacy}
              </a>
            </li>
            <li>
              <a className="text-text-muted no-underline hover:underline" href="impressum.html">
                {t.impressum}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.08em] text-text-muted uppercase">
            {t.funding}
          </p>
          <div className="flex flex-row items-center gap-3">
            <img
              src={`/logo/${lang}/BMFTR_${lang}.png`}
              alt={t.bmftrAlt}
              className="h-30 w-auto rounded-md bg-white px-2.5 py-2"
            />
            <img
              src={`/logo/${lang}/P_${lang}.png`}
              alt={t.prototypeFundAlt}
              className="h-30 w-auto rounded-md bg-white px-2.5 py-2"
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-row gap-2">
        <a
          href="https://mastodon.social/@openinvoicexml"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.mastodonAria}
          className="rounded p-1.5 text-text-muted hover:text-text focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z" />
          </svg>
        </a>
        <a
          href="https://www.linkedin.com/company/126474149/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.linkedinAria}
          className="rounded p-1.5 text-text-muted hover:text-text focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </a>
        <a
          href="https://www.facebook.com/profile.php?id=61590317082062"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.facebookAria}
          className="rounded p-1.5 text-text-muted hover:text-text focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
          </svg>
        </a>
        <a
          href="https://www.instagram.com/openinvoicexml/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.instagramAria}
          className="rounded p-1.5 text-text-muted hover:text-text focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
          </svg>
        </a>
        <a
          href="https://www.threads.com/@openinvoicexml"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.threadsAria}
          className="rounded p-1.5 text-text-muted hover:text-text focus-visible:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z" />
          </svg>
        </a>
      </div>
    </footer>
  );
}
