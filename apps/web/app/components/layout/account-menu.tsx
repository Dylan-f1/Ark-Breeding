import type { PublicUser, TribesResponse } from "@ark-breeding/core";
import { ChevronDown, LogOut, Plus, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { CreateTribeDialog } from "~/components/tribe/create-tribe-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { logout, switchTribe } from "~/lib/api";

/** The player's menu in the rail: tribes, account, sign-out. Used by the signed-in and public layouts. */
export function AccountMenu({ user, tribes, onChanged }: { user: PublicUser; tribes: TribesResponse; onChanged(): Promise<unknown> }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  async function handleLogout() {
    await logout();
    await onChanged();
    navigate("/");
  }

  async function handleSwitch(tribeId: string) {
    if (tribeId === tribes.current.id) return;
    await switchTribe(tribeId);
    await onChanged();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto max-w-56 gap-2 px-2 py-1 lg:w-full lg:max-w-none lg:justify-start"
            title={`${tribes.current.name}, ${tribes.current.server?.name ?? "réglages de la tribu"}`}
            aria-label={`Menu du compte et des tribus (tribu ${tribes.current.name}${tribes.current.server ? `, serveur ${tribes.current.server.name}` : ""})`}
          >
            <Avatar className="size-7">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            {/* several servers = several tribes: the rail always says which one is open */}
            <span className="min-w-0 text-left md:hidden lg:block">
              <span className="block truncate text-sm">{tribes.current.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{tribes.current.server?.name ?? "Réglages de la tribu"}</span>
            </span>
            <ChevronDown className="size-4 opacity-60 md:hidden lg:ml-auto lg:inline" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="font-normal">
            Connecté en tant que <span className="font-medium">{user.displayName}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Mes tribus et leurs serveurs</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={tribes.current.id} onValueChange={(id) => void handleSwitch(id)}>
            {tribes.tribes.map((t) => (
              <DropdownMenuRadioItem key={t.id} value={t.id}>
                <span className="min-w-0">
                  <span className="block truncate">{t.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.server?.name ?? "Réglages de la tribu"}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuItem onSelect={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden /> Créer une tribu
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/tribu">
              <Users className="size-4" aria-hidden /> Gérer la tribu
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/compte">
              <UserRound className="size-4" aria-hidden /> Mon compte
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void handleLogout()}>
            <LogOut className="size-4" aria-hidden /> Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateTribeDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          toast.success("Tribu créée.");
          void onChanged();
          navigate("/tribu");
        }}
      />
    </>
  );
}
