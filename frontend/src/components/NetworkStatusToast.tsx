/**
 * NetworkStatusToast — shows toasts when the browser goes offline/online.
 * Render once in DashboardLayout. Listens to window online/offline events.
 */

import { useEffect } from "react";
import { showToast } from "@/components/Toast";

export function NetworkStatusToast() {
  useEffect(() => {
    function handleOffline() {
      showToast({
        kind: "warning",
        title: "No internet connection",
        body: "You're offline. Changes will sync when your connection is restored.",
        duration: 10000,
      });
    }

    function handleOnline() {
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
