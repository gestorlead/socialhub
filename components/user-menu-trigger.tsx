
import { forwardRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getRoleName } from "@/lib/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types/database";

interface UserMenuTriggerProps {
  user: User | null;
  profile: Profile | null;
  userRole: number | null;
}

export const UserMenuTrigger = forwardRef<
  HTMLDivElement,
  UserMenuTriggerProps
>(({ user, profile, userRole, ...props }, ref) => {
  const accountName = profile?.full_name || user?.email || "Account";
  const roleName = getRoleName(userRole);
  const initials = accountName?.charAt(0).toUpperCase() || "U";

  return (
    <div
      ref={ref}
      className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-muted"
      {...props}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={profile?.avatar_url || undefined} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col">
        <span className="text-sm font-medium leading-none">
          {accountName}
        </span>
        <span className="text-xs text-muted-foreground leading-none mt-1">
          {roleName}
        </span>
      </div>
    </div>
  );
});

UserMenuTrigger.displayName = "UserMenuTrigger";
