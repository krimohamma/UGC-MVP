import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Same rationale as terms/page.tsx: full content is French-only pending
// legal review; the Arabic route is an honest stub, not a 404.
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("legal");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {t("draftNotice")}
      </div>

      {locale === "ar" ? <ArabicStub /> : <FrenchPrivacy />}
    </div>
  );
}

function ArabicStub() {
  return (
    <div className="flex flex-col gap-4 text-start">
      <h1 className="text-2xl font-bold">سياسة الخصوصية</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        النسخة العربية الكاملة من سياسة الخصوصية قيد المراجعة القانونية.
        يرجى الرجوع إلى{" "}
        <Link href="/privacy" locale="fr" className="text-primary underline">
          النسخة الفرنسية
        </Link>{" "}
        للاطلاع على النص الكامل الحالي.
      </p>
    </div>
  );
}

function FrenchPrivacy() {
  return (
    <div className="flex flex-col gap-6 text-start">
      <h1 className="text-2xl font-bold sm:text-3xl">Politique de Confidentialité</h1>
      <p className="text-xs text-muted-foreground">Dernière mise à jour : à compléter avant publication.</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">1. Données collectées</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nous collectons : les informations de compte (nom, e-mail, rôle,
          numéro de téléphone si fourni) ; les informations de profil
          créateur (biographie, niche, portfolio de vidéos) ; les
          informations de profil marque (nom de boutique) ; les fichiers que
          vous téléversez (portfolio, livrables, preuves de paiement) ; les
          messages échangés dans le cadre d'une commande ; les informations
          de paiement manuel (compte CCP / BaridiMob, à des fins de retrait
          uniquement — aucune donnée de carte bancaire n'est collectée, il
          n'existe pas de passerelle de paiement automatisée à ce stade).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">2. Utilisation des données</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ces données servent à faire fonctionner la marketplace : mise en
          relation créateurs/marques, gestion des commandes et du paiement
          séquestre, vérification manuelle des paiements et retraits par un
          administrateur, et communication liée à une commande.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">3. Sous-traitants</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Les données sont hébergées via Supabase (base de données,
          authentification, stockage de fichiers). Aucune autre donnée n'est
          partagée avec un tiers à ce jour.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">4. Sécurité</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          L'accès aux données est restreint par des règles de sécurité au
          niveau des lignes (Row Level Security) : un utilisateur ne peut
          consulter que ses propres données et celles des commandes
          auxquelles il participe ; les administrateurs y accèdent dans le
          cadre de la vérification des paiements et du contrôle qualité.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-bold">5. Droits des utilisateurs</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          [À COMPLÉTER — modalités d'exercice des droits d'accès, de
          rectification et de suppression, à rédiger conformément à la
          législation algérienne applicable (loi n° 18-07 relative à la
          protection des personnes physiques dans le traitement des données
          à caractère personnel) avec un conseil juridique avant publication.]
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-bold">6. Durée de conservation</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          [À COMPLÉTER — durées de conservation précises à déterminer avant
          publication.]
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">7. Contact</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          [À COMPLÉTER — coordonnées de contact officielles pour toute
          question relative à la confidentialité des données.]
        </p>
      </section>
    </div>
  );
}
