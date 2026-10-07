import { Capacitor, registerPlugin } from "@capacitor/core";

interface AuthVaultPlugin {
  read(): Promise<{ value: string | null }>;
  write(options: { value: string }): Promise<void>;
}
const NativeVault = registerPlugin<AuthVaultPlugin>("LinkUpAuthVault");
const WEB_KEY = "linkup_auth_session_v1";

// Android persists encrypted credentials outside backups. Browser development
// sessions stay in the current tab; long-lived tokens never go in localStorage.
export async function readSessionVault(): Promise<string | null> {
  if (Capacitor.getPlatform() === "android")
    return (await NativeVault.read()).value;
  return sessionStorage.getItem(WEB_KEY);
}
export async function writeSessionVault(value: string): Promise<void> {
  if (Capacitor.getPlatform() === "android") await NativeVault.write({ value });
  else sessionStorage.setItem(WEB_KEY, value);
}
