import { type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        {icon && <div className="text-primary">{icon}</div>}
        <div>
          <h3 className="text-base font-medium">{title}</h3>
          {description && (
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
