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

    const checkForWaitingWorker = (reg: ServiceWorkerRegistrationWithWaiting) => {
      if (reg.waiting) {
        setRegistration(reg);
        setNeedsUpdate(true);
      }
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      const typedReg = reg as ServiceWorkerRegistrationWithWaiting;
      checkForWaitingWorker(typedReg);
      reg.update().catch(() => {
        // Swallow — preview env may redirect sw.js
      });

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setRegistration(typedReg);
            setNeedsUpdate(true);
          }
        });
      });
    });

    const interval = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => {}));
    }, 30_000);

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
