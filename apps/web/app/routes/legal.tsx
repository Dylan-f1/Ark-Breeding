import asbLicense from "@ark-breeding/core/data/ASB-LICENSE.txt?raw";
import type { Route } from "./+types/legal";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Mentions légales et crédits — Ark-breeding" }];
}

export default function Legal() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold">Mentions légales et crédits</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Site non officiel</h2>
        <p>
          Ark-breeding est un site de fans, sans lien avec Studio Wildcard ni Snail Games. ARK: Survival
          Ascended et ARK: Survival Evolved sont des marques de leurs propriétaires respectifs.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Éditeur et hébergement</h2>
        <p>
          Projet personnel open source :{" "}
          <a className="underline underline-offset-2" href="https://github.com/Dylan-f1/Ark-Breeding" rel="noreferrer" target="_blank">
            github.com/Dylan-f1/Ark-Breeding
          </a>
          .
        </p>
        <p>Hébergement : Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Données personnelles</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            À la connexion avec Discord, on enregistre uniquement ton identifiant, ton pseudo et ton avatar
            Discord. Jamais ton email.
          </li>
          <li>Un seul cookie, strictement nécessaire : ta session de connexion, valable 30 jours.</li>
          <li>Aucun traceur, aucune publicité, aucun cookie de mesure d'audience.</li>
          <li>Tes créatures sont visibles par toi et par les membres de ta tribu, personne d'autre.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Crédits</h2>
        <p>
          Les valeurs de stats des créatures et l'algorithme d'extraction des niveaux sont repris d'
          <a className="underline underline-offset-2" href="https://github.com/cadon/ARKStatsExtractor" rel="noreferrer" target="_blank">
            ARK Smart Breeding
          </a>
          , distribué sous la licence MIT ci-dessous.
        </p>
        <pre className="overflow-x-auto rounded-md border bg-muted p-4 text-xs whitespace-pre-wrap">{asbLicense}</pre>
      </section>
    </article>
  );
}
