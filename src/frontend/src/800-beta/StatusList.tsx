import { Fragment, useState, type JSX } from "react";
import { useTranslation } from "../000-core/i18n";
import { phasesDict, statusLabelDict, type Phase, type PhaseStatus } from "./StatusList.i18n";

const STATUS_RING_CLASS: Record<PhaseStatus, string> = {
  done: "border-done bg-done",
  progress: "border-progress bg-progress ring-[3px] ring-progress/20",
  upcoming: "border-upcoming bg-transparent",
};

const STATUS_LINE_CLASS: Record<PhaseStatus, string> = {
  done: "bg-done",
  progress: "bg-progress",
  upcoming: "bg-upcoming",
};

const STATUS_TAG_CLASS: Record<PhaseStatus, string> = {
  done: "bg-done/15 text-done",
  progress: "bg-progress/15 text-progress",
  upcoming: "bg-upcoming/20 text-text-muted",
};

function PhaseNode({
  phase,
  isOpen,
  onToggle,
}: {
  phase: Phase;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="flex flex-none flex-col items-center gap-2 bg-transparent p-0"
    >
      <span className="text-xs text-text-muted">{phase.shortLabel}</span>
      <span
        className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border-2 ${STATUS_RING_CLASS[phase.status]} ${
          isOpen ? "ring-[3px] ring-accent/30" : ""
        }`}
      >
        {phase.status === "done" && (
          <svg viewBox="0 0 12 12" className="h-3 w-3 fill-none stroke-accent-text stroke-2">
            <path d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

export function StatusList(): JSX.Element {
  const { t: phases, lang } = useTranslation(phasesDict);
  const statusLabel = statusLabelDict[lang];
  const [openIndex, setOpenIndex] = useState<number | null>(
    phases.findIndex((phase) => phase.status === "progress"),
  );

  const openPhase = openIndex !== null ? phases[openIndex] : null;

  return (
    <div className="rounded-[10px] border border-border bg-surface p-5">
      <div className="flex items-start">
        {phases.map((phase, i) => (
          <Fragment key={i}>
            <PhaseNode
              phase={phase}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
            {i < phases.length - 1 && (
              <span
                className={`mt-3 h-[2px] flex-1 self-start ${STATUS_LINE_CLASS[phase.status]}`}
              />
            )}
          </Fragment>
        ))}
      </div>

      <div
        className="grid transition-all duration-200"
        style={{ gridTemplateRows: openPhase ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {openPhase && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold text-text">{openPhase.title}</span>
                <span className="text-xs text-text-muted">{openPhase.period}</span>
                <span
                  className={`rounded-full px-[0.55rem] py-[0.2rem] text-xs whitespace-nowrap ${STATUS_TAG_CLASS[openPhase.status]}`}
                >
                  {statusLabel[openPhase.status]}
                </span>
              </div>
              <p className="mt-2 mb-3 text-sm text-text-muted">{openPhase.description}</p>
              <ul className="m-0 list-none space-y-1 p-0">
                {openPhase.subItems.map((item) => (
                  <li key={item} className="text-sm text-text-muted">
                    <span className="text-text">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
