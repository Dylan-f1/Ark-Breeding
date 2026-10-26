import { useMemo, useState } from "react";
import { Shuffle } from "lucide-react";
import { ArkCreatureImage } from "~/components/colors/ark-image";
import { ColorBanner, ColorEgg, ColorPills, DinoSilhouette, RegionSwatches } from "~/components/colors/previews";
import { regionColors } from "~/components/colors/regions";
import { SpeciesPicker } from "~/components/library/species-picker";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { useSpeciesData } from "~/lib/species";
import type { Route } from "./+types/colors-preview";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Aperçu des couleurs : propositions — Ark-breeding" }, { name: "robots", content: "noindex" }];
}

const START = { speciesId: "Rex_Character_BP", colors: [26, 34, 0, 0, 27, 23] };

/** EF-22: design proposals for the colour preview, side by side on the same creature (D-27). */
export default function ColorsPreview() {
  const speciesData = useSpeciesData();
  const [speciesId, setSpeciesId] = useState(START.speciesId);
  const [colors, setColors] = useState(START.colors);

  const colorById = useMemo(() => new Map(speciesData?.colors.map((c) => [c.id, c]) ?? []), [speciesData]);
  const baseColors = useMemo(() => speciesData?.colors.filter((c) => !c.dye) ?? [], [speciesData]);
  const options = useMemo(() => {
    const ids = new Set(speciesData?.catalog.map((c) => c.id));
    return speciesData?.options.filter((o) => ids.has(o.id)) ?? [];
  }, [speciesData]);

  if (!speciesData) return <p role="status" className="text-muted-foreground">Chargement…</p>;
  const species = speciesData.byId(speciesId);
  const regions = regionColors(colors, species?.raw.colorRegions, colorById);
  const name = `${species?.label ?? "Dino"} de démonstration`;

  function shuffle() {
    setColors(colors.map(() => baseColors[Math.floor(Math.random() * baseColors.length)]?.id ?? 0));
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Aperçu des couleurs : propositions</h1>
        <p className="text-muted-foreground">
          Six façons de montrer les 6 régions de couleur d'un dino. Rien n'est tiré des fichiers du jeu (risque R-03) :
          choisis celle(s) à garder.
        </p>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
          <div className="space-y-1">
            <Label htmlFor="apercu-espece">Espèce</Label>
            <SpeciesPicker id="apercu-espece" options={options} value={speciesId} onChange={setSpeciesId} />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-medium">Couleurs des régions</span>
            <div className="flex flex-wrap items-end gap-2">
              {colors.map((id, i) => (
                <label key={i} className="space-y-1 text-xs text-muted-foreground">
                  <span className="block">
                    {i} · {species?.raw.colorRegions?.[i] ?? "—"}
                  </span>
                  <select
                    className="h-9 w-36 rounded-md border bg-background px-2 text-sm text-foreground"
                    value={id}
                    onChange={(e) => setColors(colors.map((c, j) => (j === i ? Number(e.target.value) : c)))}
                  >
                    <option value={0}>0 · aucune</option>
                    {speciesData.colors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} · {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <Button variant="outline" size="sm" onClick={shuffle}>
                <Shuffle className="size-4" aria-hidden /> Au hasard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Proposal
        n={0}
        title="Rendu ARK (comme ASB)"
        pros="Le vrai dessin de la créature dans ARK, colorié région par région, comme dans ASB. Images faites par la communauté à partir du jeu (github.com/arkutils/species-images, licence MIT) : 546 espèces, versions ASA comprises."
        cons="Images du jeu : les créatures restent la propriété de Studio Wildcard (risque R-03, toléré pour ASB depuis des années). Une seule pose de trois quarts, pas de 3D. Hébergées avec le site (313 espèces)."
      >
        <div className="grid items-center gap-4 md:grid-cols-[minmax(0,24rem)_1fr]">
          <ArkCreatureImage speciesName={species?.raw.name ?? ""} regions={regions} />
          <RegionSwatches regions={regions} />
        </div>
      </Proposal>

      <Proposal
        n={1}
        title="Nuancier"
        pros="Le plus précis : nom et numéro de chaque couleur, utile pour reproduire une couleur ou viser une mutation de couleur."
        cons="Prend de la place : pour la fiche, pas pour les listes."
      >
        <RegionSwatches regions={regions} />
      </Proposal>

      <Proposal
        n={2}
        title="Pastilles"
        pros="Compact et lisible, chaque pastille porte le numéro de la région ; le détail s'affiche au survol."
        cons="Pas de forme de dino."
      >
        <div className="space-y-3">
          <ColorPills regions={regions} />
          <LibraryRowMock name={name}>
            <ColorPills regions={regions} size="sm" />
          </LibraryRowMock>
        </div>
      </Proposal>

      <Proposal
        n={3}
        title="Silhouette"
        pros="Le plus parlant : on « voit » le dino. Dessin maison, aucun droit à demander ; les zones suivent le nom des régions de l'espèce (corps, ventre, dos, tête, pattes, motifs)."
        cons="Une seule silhouette pour toutes les espèces : un Argentavis ressemble à un Rex. On peut ensuite dessiner des familles (volants, quadrupèdes, aquatiques)."
      >
        <div className="grid items-center gap-4 md:grid-cols-[2fr_1fr]">
          <DinoSilhouette regions={regions} className="text-foreground" />
          <ul className="space-y-1 text-sm">
            {regions.map((r) => (
              <li key={r.index} className="flex items-center gap-2">
                <span className="size-4 rounded-sm border" style={{ background: r.hex }} aria-hidden />
                {r.name} — {r.color?.name ?? "—"}
              </li>
            ))}
          </ul>
        </div>
      </Proposal>

      <Proposal
        n={4}
        title="Œuf"
        pros="Un petit avatar par dino dans les listes et l'arbre généalogique, reconnaissable d'un coup d'œil."
        cons="Les couleurs y sont empilées : on ne lit pas quelle région porte quelle couleur sans survol."
      >
        <div className="space-y-3">
          <div className="flex items-end gap-4">
            <ColorEgg regions={regions} size={96} />
            <ColorEgg regions={regions} size={48} />
            <ColorEgg regions={regions} size={28} />
          </div>
          <LibraryRowMock name={name} avatar={<ColorEgg regions={regions} size={32} />} />
        </div>
      </Proposal>

      <Proposal
        n={5}
        title="Bandeau"
        pros="Met la fiche du dino à ses couleurs : un en-tête unique pour chaque créature."
        cons="Décoratif : à combiner avec le nuancier ou les pastilles pour le détail."
      >
        <ColorBanner regions={regions} title={name} subtitle={`${species?.label ?? ""} · niveau 224 · élevé`} />
      </Proposal>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Combinaison possible</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Œuf dans la bibliothèque, bandeau + rendu ARK + nuancier sur la fiche.
          </p>
          <LibraryRowMock name={name} avatar={<ColorEgg regions={regions} size={32} />}>
            <ColorPills regions={regions} size="sm" />
          </LibraryRowMock>
          <ColorBanner regions={regions} title={name} subtitle={`${species?.label ?? ""} · niveau 224 · élevé`} />
          <div className="grid items-start gap-4 md:grid-cols-2">
            <ArkCreatureImage speciesName={species?.raw.name ?? ""} regions={regions} />
            <RegionSwatches regions={regions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Proposal(props: { n: number; title: string; pros: string; cons: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            <span className="text-muted-foreground">{props.n}.</span> {props.title}
          </h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {props.children}
        <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
          <dt className="font-medium text-primary">Pour</dt>
          <dd className="text-muted-foreground">{props.pros}</dd>
          <dt className="font-medium text-destructive">Contre</dt>
          <dd className="text-muted-foreground">{props.cons}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

/** How a design would sit in a library row. */
function LibraryRowMock({ name, avatar, children }: { name: string; avatar?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
      {avatar}
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground">♀ · niv. 224</span>
      <span className="ml-auto">{children}</span>
    </div>
  );
}
