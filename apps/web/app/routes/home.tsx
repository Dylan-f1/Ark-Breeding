import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Ark-breeding — l'élevage ARK Survival Ascended, partagé avec ta tribu" },
    {
      name: "description",
      content:
        "Extracteur de stats, bibliothèque partagée par tribu, plan d'élevage et suivi des mutations pour ARK Survival Ascended. Sur mobile comme sur PC.",
    },
  ];
}

const features = [
  {
    title: "Ajoute tes dinos en 30 secondes",
    description: "Glisse tes fichiers d'export du jeu, ou saisis les valeurs affichées en jeu.",
  },
  {
    title: "Les meilleurs couples, tout de suite",
    description: "Le plan d'élevage classe les 5 couples qui font progresser ta lignée.",
  },
  {
    title: "Une bibliothèque pour toute la tribu",
    description: "Chaque membre voit les mêmes créatures, sur téléphone comme sur PC.",
  },
  {
    title: "Généalogie et mutations",
    description: "Arbre sur 5 générations et compteurs de mutations côté mère et côté père.",
  },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="space-y-4 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          L'élevage ARK, sans prise de tête
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Sache en quelques secondes quel couple accoupler pour faire progresser ta lignée, depuis
          n'importe quel appareil, avec toute ta tribu.
        </p>
        <Button asChild size="lg">
          <Link to="/connexion">Commencer</Link>
        </Button>
      </section>

      <section aria-label="Fonctionnalités" className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle>{f.title}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
