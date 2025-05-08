import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Ping indicator component with Shadcn UI styling
 * @param {Object} props - Component props
 * @param {number|null} props.pingMs - Ping value in milliseconds, null for measuring, -1 for timeout
 */
export function PingIndicator({ pingMs }) {
  // Get ping status and color based on ping value
  const getPingStatus = (ping) => {
    if (ping === null) return { status: "measuring", color: "bg-gray-400", text: "text-gray-400" };
    if (ping < 0) return { status: "timeout", color: "bg-destructive", text: "text-destructive" };
    if (ping < 100) return { status: "good", color: "bg-green-500", text: "text-green-500" };
    if (ping < 250) return { status: "medium", color: "bg-orange-500", text: "text-orange-500" };
    return { status: "poor", color: "bg-red-500", text: "text-red-500" };
  };

  // Get ping text to display
  const getPingText = (ping) => {
    if (ping === null) return "Measuring...";
    if (ping < 0) return "Timeout";
    return `${ping}ms`;
  };

  // Get tooltip text based on ping status
  const getTooltipText = (status) => {
    switch (status) {
      case "good": return "Good connection";
      case "medium": return "Average connection";
      case "poor": return "Poor connection";
      case "timeout": return "Connection timeout";
      default: return "Measuring connection...";
    }
  };

  const { status, color, text } = getPingStatus(pingMs);
  const tooltipText = getTooltipText(status);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="fixed bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-2 shadow-md border-muted">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full animate-pulse ${color}`} />
              <span className={`font-mono ${text}`}>Ping: {getPingText(pingMs)}</span>
            </div>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
