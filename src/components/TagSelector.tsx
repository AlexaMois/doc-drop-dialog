import * as React from "react";
import { Check, Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { CatalogOption } from "@/hooks/useBpiumCatalogs";

interface TagSelectorProps {
  availableTags: CatalogOption[];
  suggestedTags: CatalogOption[];
  selectedTags: string[];
  onChange: (selected: string[]) => void;
  isLoading?: boolean;
  isAiLoading?: boolean;
}

export function TagSelector({
  availableTags,
  suggestedTags,
  selectedTags,
  onChange,
  isLoading,
  isAiLoading,
}: TagSelectorProps) {
  const handleToggle = (tagValue: string) => {
    if (selectedTags.includes(tagValue)) {
      onChange(selectedTags.filter((t) => t !== tagValue));
    } else {
      onChange([...selectedTags, tagValue]);
    }
  };

  const hasSuggestions = suggestedTags.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>Теги</Label>
        <div className="h-20 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Теги (необязательно)</Label>
      
      {/* AI-подсказки тегов */}
      {(hasSuggestions || isAiLoading) && (
        <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 text-sm">
            {isAiLoading ? (
              <>
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                <span className="text-muted-foreground">AI анализирует документ...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">AI рекомендует:</span>
              </>
            )}
          </div>
          {!isAiLoading && hasSuggestions && (
            <div className="flex flex-wrap gap-2">
              {suggestedTags.map((tag) => {
                const isSelected = selectedTags.includes(tag.value);
                return (
                  <Badge
                    key={tag.value}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-all hover:scale-105",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border-primary/50 text-primary hover:bg-primary/10"
                    )}
                    onClick={() => handleToggle(tag.value)}
                  >
                    {isSelected && <Check className="h-3 w-3 mr-1" />}
                    {tag.label}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Все доступные теги */}
      <div className="space-y-2">
        {hasSuggestions && (
          <span className="text-sm text-muted-foreground">Все теги:</span>
        )}
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg max-h-40 overflow-y-auto">
          {availableTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.value);
            const isSuggested = suggestedTags.some((s) => s.value === tag.value);
            
            return (
              <Badge
                key={tag.value}
                variant={isSelected ? "default" : "secondary"}
                className={cn(
                  "cursor-pointer transition-all hover:scale-105",
                  isSelected && "bg-primary text-primary-foreground",
                  !isSelected && isSuggested && "ring-1 ring-primary/30"
                )}
                onClick={() => handleToggle(tag.value)}
              >
                {isSelected && <Check className="h-3 w-3 mr-1" />}
                {tag.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {selectedTags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Выбрано тегов: {selectedTags.length}
        </p>
      )}
    </div>
  );
}
