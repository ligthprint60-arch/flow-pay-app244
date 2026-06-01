import { useAuth } from "@/lib/auth";

const ADMIN_EMAILS = ["studioinfinit81@gmail.com"];

export function useIsAdmin() {
  const { user } = useAuth();
  return !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
}
