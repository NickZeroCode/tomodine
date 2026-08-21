import { useTranslation } from "react-i18next";
import { Reveal } from "@/components/Reveal";

/**
 * "Restaurants that already trust us" — infinite logo marquee.
 *
 * Real partner logo images (each carries its own brand name), scrolling
 * seamlessly (duplicated track + CSS animation), pausing on hover.
 */

const LOGOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
  (n) => `/images/trust-restaurant/restaurant-${n}.png`
);

function LogoImage({ src }: { src: string }) {
  return (
    <div className="flex shrink-0 items-center px-6 sm:px-8">
      <img
        src={src}
        alt=""
        loading="lazy"
        draggable={false}
        className="h-16 w-auto object-contain opacity-90 transition-all duration-300 hover:scale-105 hover:opacity-100 sm:h-20"
      />
    </div>
  );
}

export function TrustedMarquee() {
  const { t } = useTranslation();

  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = [...LOGOS, ...LOGOS];

  return (
    <section className="border-y border-ink-100 bg-white py-12">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <h2 className="text-center text-xl font-bold text-ink-900 sm:text-2xl">
            {t("landing.trustTitle")}
          </h2>
        </Reveal>
      </div>

      {/* Edge-faded marquee strip */}
      <Reveal delay={120}>
        <div className="group relative mt-10 overflow-hidden">
          {/* Fade masks on both edges */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-24"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-24"
          />

          <div className="marquee-track flex w-max items-center py-2 group-hover:[animation-play-state:paused]">
            {loop.map((src, i) => (
              <LogoImage key={`${src}-${i}`} src={src} />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
