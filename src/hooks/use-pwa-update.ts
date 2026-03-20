import { useEffect, useState } from "react";

interface ServiceWorkerRegistrationWithWaiting extends ServiceWorkerRegistration {
  waiting: ServiceWorker | null;
}

export function usePwaUpdate() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistrationWithWaiting | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker.ready.then((reg) => {
      // Check if there's already a waiting worker
      if (reg.waiting) {
        setRegistration(reg as ServiceWorkerRegistrationWithWaiting);
        setNeedsUpdate(true);
      }

      // Listen for new service workers
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setRegistration(reg as ServiceWorkerRegistrationWithWaiting);
            setNeedsUpdate(true);
          }
        });
      });
    });

    // Check for updates every 60 seconds
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }, 60_000);

    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const applyUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };

  return { needsUpdate, applyUpdate };
}
