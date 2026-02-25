import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Share, MoreVertical, Plus, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Install App</h1>
            <p className="text-[11px] text-muted-foreground">Add to your home screen</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-md space-y-6">
        {isInstalled ? (
          <Card className="border-0 shadow-sm bg-success/10">
            <CardContent className="p-6 text-center space-y-3">
              <Check className="h-12 w-12 text-success mx-auto" />
              <h2 className="text-xl font-bold">Already Installed!</h2>
              <p className="text-sm text-muted-foreground">
                Payment Collector is installed on your device. Open it from your home screen.
              </p>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 text-center space-y-4">
              <Download className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold">Install Payment Collector</h2>
              <p className="text-sm text-muted-foreground">
                Install this app on your device for quick access. It works offline and feels just like a native app.
              </p>
              <Button onClick={handleInstall} className="w-full gap-2" size="lg">
                <Download className="h-5 w-5" />
                Install Now
              </Button>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <Share className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-center">Install on iPhone/iPad</h2>
              <p className="text-sm text-muted-foreground text-center">
                Follow these steps to install:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <span>Tap the <Share className="inline h-4 w-4" /> <strong>Share</strong> button in Safari's toolbar</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <Plus className="inline h-4 w-4" /></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>Tap <strong>"Add"</strong> to confirm</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4">
              <MoreVertical className="h-12 w-12 text-primary mx-auto" />
              <h2 className="text-xl font-bold text-center">Install on Android</h2>
              <p className="text-sm text-muted-foreground text-center">
                Follow these steps to install:
              </p>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                  <span>Tap the <MoreVertical className="inline h-4 w-4" /> <strong>menu</strong> button in Chrome</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                  <span>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                  <span>Tap <strong>"Install"</strong> to confirm</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Install;
