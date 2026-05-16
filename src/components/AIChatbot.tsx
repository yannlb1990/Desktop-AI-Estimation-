import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, X, Minimize2, Maximize2, Sparkles } from "lucide-react";

export const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const location = useLocation();

  if (location.pathname === "/auth" || location.pathname === "/") return null;

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:bg-accent/90"
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className={`fixed ${isMinimized ? 'bottom-6 right-6 w-80' : 'bottom-6 right-6 w-96 h-[420px]'} shadow-2xl flex flex-col`}>
      <div className="flex items-center justify-between p-4 border-b border-border bg-accent/10">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-accent" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-8 w-8"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <h4 className="font-semibold text-lg mb-2">AI Chat Coming Soon</h4>
          <p className="text-sm text-muted-foreground mb-4">
            The AI assistant requires a backend connection. Use the Market Insights page for pricing data and the built-in estimating tools for calculations.
          </p>
          <div className="w-full space-y-2 text-left">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available now:</p>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>• 500+ material prices in Materials Library</p>
              <p>• 26 trades with SOW rates in Market Insights</p>
              <p>• Auto cost estimation in projects</p>
              <p>• BOQ & SOW export tools</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
