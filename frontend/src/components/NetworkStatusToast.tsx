/**
 * NetworkStatusToast — shows toasts when the browser goes offline/online.
 * Render once in DashboardLayout. Listens to window online/offline events.
 */

import { useEffect } from "react";
import { showToast, dismissToast } from "@/components/Toast";

const OFFLINE_TOAST_ID = "network-offline";

export function NetworkStatusToast() {
  useEffect(() => {
    function handleOffline() {
      showToast({
        id: OFFLINE_TOAST_ID,
        kind: "warning",
        title: "No internet connection",
        body: "You're offline. Changes will sync when your connection is restored.",
        duration: 0,
      });
    }

    function handleOnline() {
      dismissToast(OFFLINE_TOAST_ID);
      showToast({
        kind: "success",
        title: "Back online",
        body: "Your internet connection has been restored.",
        duration: 5000,
      });
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null; // renders nothing
}
