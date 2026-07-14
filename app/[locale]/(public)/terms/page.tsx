import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Full content is French-only for now (see privacy/page.tsx for the same
// pattern and rationale) — long-form legal prose doesn't belong in
// messages/*.json alongside UI chrome strings, and this content needs a
// real legal review pass before a faithful Arabic translation is worth
// doing. The Arabic route still resolves; it's an honest stub, not a 404.
export default async function TermsPage({
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

      {locale === "ar" ? (
        <ArabicStub />
      ) : (
        <FrenchTerms />
      )}
    </div>
  );
}

function ArabicStub() {
  return (
    <div className="flex flex-col gap-4 text-start">
      <h1 className="text-2xl font-bold">شروط الاستخدام</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">
        النسخة العربية الكاملة من شروط الاستخدام قيد المراجعة القانونية. يرجى
        الرجوع إلى{" "}
        <Link href="/terms" locale="fr" className="text-primary underline">
          النسخة الفرنسية
        </Link>{" "}
        للاطلاع على النص الكامل الحالي.
      </p>
    </div>
  );
}

function FrenchTerms() {
  return (
    <div className="flex flex-col gap-6 text-start">
      <h1 className="text-2xl font-bold sm:text-3xl">Conditions Générales d'Utilisation</h1>
      <p className="text-xs text-muted-foreground">Dernière mise à jour : à compléter avant publication.</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">1. Objet</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Souk est une marketplace mettant en relation des créateurs de
          contenu (UGC — "user-generated content") et des marques ou
          boutiques en ligne opérant en Algérie. Un créateur publie des
          services ("gigs") avec des formules tarifées ; une marque commande
          l'une de ces formules.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">2. Comptes et rôles</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Chaque utilisateur dispose d'un rôle unique : créateur, marque, ou
          administrateur (les comptes administrateur sont créés manuellement
          par la plateforme). Vous êtes responsable de l'exactitude des
          informations fournies lors de l'inscription et de la
          confidentialité de vos identifiants de connexion.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">3. Commandes et paiement séquestre (escrow)</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Au moment de la commande, le prix de la formule choisie est figé
          pour cette commande. Le paiement s'effectue actuellement de
          manière manuelle (virement CCP ou BaridiMob) : la marque transmet
          une preuve de paiement, qu'un administrateur vérifie avant que la
          commande ne démarre. Les fonds sont conservés par la plateforme
          jusqu'à validation de la livraison par la marque, puis reversés au
          créateur, déduction faite de la commission de la plateforme.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">4. Livraison, révisions et litiges</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Chaque formule inclut un nombre de révisions défini par le
          créateur. Une fois ce nombre atteint, toute modification
          supplémentaire est à la discrétion du créateur. En cas de désaccord
          sur la qualité ou la conformité de la livraison, la marque peut
          ouvrir un litige, examiné par un administrateur.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">5. Avis</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Une fois une commande terminée, la marque et le créateur peuvent
          chacun laisser un avis noté sur 5. Les avis sont publics et ne
          peuvent pas être modifiés une fois publiés.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">6. Comportements interdits</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Sont notamment interdits : la publication de contenu illicite, la
          tentative de contourner le paiement séquestre de la plateforme, la
          fraude, l'usurpation d'identité, et toute utilisation portant
          atteinte à un tiers.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-bold">7. Propriété intellectuelle</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          [À COMPLÉTER — clauses de cession/licence des droits sur les vidéos
          livrées, à rédiger avec un conseil juridique avant publication.]
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-bold">8. Limitation de responsabilité</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          [À COMPLÉTER — clause de limitation de responsabilité à valider par
          un conseil juridique avant publication.]
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-dashed border-border p-4">
        <h2 className="text-lg font-bold">9. Droit applicable et juridiction</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          [À COMPLÉTER — droit applicable et for compétent à déterminer avec
          un conseil juridique algérien avant publication.]
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">10. Modification des présentes conditions</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          La plateforme peut modifier ces conditions ; les utilisateurs en
          seront informés avant toute entrée en vigueur.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">11. Contact</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          [À COMPLÉTER — coordonnées de contact officielles de la plateforme.]
        </p>
      </section>
    </div>
  );
}
