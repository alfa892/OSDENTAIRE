const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050";

type Patient = {
  id: string;
  fullName: string;
  activeTreatment: string;
  nextVisit: string;
  balance: number;
  phone: string;
};

type PatientResponse = {
  data: Patient[];
};

const fallbackPatients: Patient[] = [
  {
    id: "pat-001",
    fullName: "Camille Moreau",
    phone: "+33 6 55 22 31 90",
    activeTreatment: "Invisalign · étape 4/10",
    nextVisit: "2025-03-03T09:30:00.000Z",
    balance: 120,
  },
  {
    id: "pat-002",
    fullName: "Julien Martin",
    phone: "+33 7 11 78 64 03",
    activeTreatment: "Implant molaire",
    nextVisit: "2025-03-10T14:00:00.000Z",
    balance: 0,
  },
  {
    id: "pat-003",
    fullName: "Lina Benali",
    phone: "+33 6 90 33 11 54",
    activeTreatment: "Blanchiment + détartrage",
    nextVisit: "2025-02-28T11:00:00.000Z",
    balance: 60,
  },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

async function fetchPatients() {
  try {
    const res = await fetch(`${backendUrl}/api/patients`, { cache: "no-store" });

    if (!res.ok) throw new Error("API offline");

    const data = (await res.json()) as PatientResponse;
    return { patients: data.data, status: "online" as const };
  } catch (error) {
    console.warn("Impossible de joindre l'API, utilisation des données fictives", error);
    return { patients: fallbackPatients, status: "offline" as const };
  }
}

const featureBlocks = [
  {
    title: "Gestion clinique",
    body: "Suivi des plans de traitement, consentements sécurisés et checklist bloc opératoire.",
  },
  {
    title: "Pilotage financier",
    body: "Prévisionnel d'honoraires, relances automatisées et rapprochement mutuelles.",
  },
  {
    title: "Expérience patient",
    body: "Portail patient en marque blanche avec paiement, signature et prise de RDV en ligne.",
  },
];

const pipeline = [
  { label: "Lead inbound", metric: "+34%", detail: "Campagnes Meta & Google" },
  { label: "Qualification", metric: "< 2h", detail: "Réponse moyenne" },
  { label: "Premier RDV", metric: "62%", detail: "Taux de conversion" },
  { label: "Plan accepté", metric: "48%", detail: "Ticket moyen 2 800€" },
];

export default async function Home() {
  const { patients, status } = await fetchPatients();

  const statusStyles =
    status === "online"
      ? "border-emerald-400/40 text-emerald-200 bg-emerald-500/10"
      : "border-rose-400/40 text-rose-100 bg-rose-500/10";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-12 md:px-8 lg:py-16">
      <section className="grid gap-8 rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl shadow-emerald-500/10 backdrop-blur md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1 text-sm text-emerald-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
            Beta privée · 15 cabinets onboardés
          </span>
          <div>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              OSdentaire relie patient, praticien et business en une seule interface.
            </h1>
            <p className="mt-4 text-lg text-slate-200">
              Configure la stack complète (Next.js · Express · Vercel) et commence à alimenter une base de
              données temps réel pour ton cabinet dentaire.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <a
              href="mailto:founders@osdentaire.com?subject=Demo%20OSdentaire"
              className="rounded-full bg-emerald-400 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-300"
            >
              Planifier une démo
            </a>
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Déployer sur Vercel
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {featureBlocks.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100"
              >
                <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-slate-200">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <p className="text-sm uppercase tracking-widest text-slate-400">API Express</p>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-white">{backendUrl}</p>
              <p className="text-sm text-slate-300">Route /api/patients</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles}`}>
              {status === "online" ? "Connectée" : "Hors ligne"}
            </span>
          </div>
          <pre className="mt-6 rounded-xl bg-black/60 p-4 text-xs text-emerald-200">
{`curl ${backendUrl}/healthz`}
          </pre>
          <p className="mt-4 text-xs text-slate-400">
            Configure l&apos;env <code className="text-emerald-200">NEXT_PUBLIC_API_URL</code> sur Vercel pour pointer vers l&apos;API Railway / Render / VPS.
          </p>
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur md:grid-cols-[3fr_2fr]">
        <div>
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-200">Aujourd&apos;hui</p>
              <h2 className="text-2xl font-semibold text-white">Patients à suivre</h2>
            </div>
            <span className="text-sm text-slate-300">{new Date().toLocaleDateString("fr-FR")}</span>
          </header>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Traitement</th>
                  <th className="px-4 py-3">Prochain RDV</th>
                  <th className="px-4 py-3 text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {patients.slice(0, 4).map((patient) => (
                  <tr key={patient.id} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{patient.fullName}</p>
                      <p className="text-xs text-slate-400">{patient.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-200">{patient.activeTreatment}</td>
                    <td className="px-4 py-3 text-slate-200">{formatDate(patient.nextVisit)}</td>
                    <td className="px-4 py-3 text-right text-slate-100">
                      {patient.balance === 0 ? (
                        <span className="text-emerald-300">0 €</span>
                      ) : (
                        `${patient.balance.toLocaleString("fr-FR")} €`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 p-5 text-white">
            <p className="text-sm uppercase tracking-widest text-emerald-100">Pipeline commercial</p>
            <div className="mt-4 space-y-4">
              {pipeline.map((step) => (
                <div key={step.label} className="flex items-center justify-between border-b border-white/10 pb-3 last:border-b-0 last:pb-0">
                  <div>
                    <p className="text-base font-semibold">{step.label}</p>
                    <p className="text-sm text-emerald-100">{step.detail}</p>
                  </div>
                  <span className="text-xl font-semibold">{step.metric}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-white/20 p-5 text-slate-100">
            <p className="text-sm text-slate-300">Checklist mise en ligne</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>1. <code className="text-emerald-200">npm run dev:api</code> pour vérifier l&apos;API localement.</li>
              <li>2. <code className="text-emerald-200">npm run dev:web</code> et configure <code className="text-emerald-200">NEXT_PUBLIC_API_URL</code>.</li>
              <li>3. Push sur GitHub → Vercel détecte automatiquement apps/web.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/5 bg-emerald-500/10 p-8 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-200">Next step</p>
        <h3 className="mt-4 text-3xl font-semibold">
          Prêt à connecter la base patient, la facturation et la communication ?
        </h3>
        <p className="mt-3 text-lg text-emerald-100">
          Cette maquette sert de point de départ : déploie-la, branche ta base (Supabase, Neon, PlanetScale) et liquides chaque module en feature flags.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <a
            href="https://github.com/new"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white px-6 py-3 text-base font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            Créer le repo GitHub
          </a>
          <a
            href="https://vercel.com/docs"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/60 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
          >
            Voir la doc de déploiement
          </a>
        </div>
      </section>
    </main>
  );
}
