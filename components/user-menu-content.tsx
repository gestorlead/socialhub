
import { LogOut, User, Settings, LifeBuoy } from "lucide-react";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";

interface UserMenuContentProps {
  user: SupabaseUser | null;
  profile: Profile | null;
  signOut: () => Promise<void>;
}

export function UserMenuContent({ user, profile, signOut }: UserMenuContentProps) {
  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = "/login?logout=true";
    } catch (error) {
      console.error("Error during sign out:", error);
      window.location.href = "/login?logout=true";
    }
  };

  return (
    <>
      <DropdownMenuLabel>
        <div className="flex flex-col space-y-1">
          <p className="text-sm font-medium leading-none">
            {profile?.full_name || "-"}
          </p>
          <p className="text-xs leading-none text-muted-foreground">
            {user?.email || "-"}
          </p>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/support">
            <LifeBuoy className="mr-2 h-4 w-4" />
            <span>Support</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        <span>Log out</span>
      </DropdownMenuItem>
    </>
  );
}
