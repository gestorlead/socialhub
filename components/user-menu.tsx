
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenuTrigger } from "./user-menu-trigger";
import { UserMenuContent } from "./user-menu-content";
import { useAuth } from "@/lib/supabase-auth-helpers";

export function UserMenu() {
  const { user, profile, userRole, signOut } = useAuth();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UserMenuTrigger
          user={user}
          profile={profile}
          userRole={userRole}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <UserMenuContent
          user={user}
          profile={profile}
          signOut={signOut}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
