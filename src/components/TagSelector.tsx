import * as React from "react";
import { Check, X, Sparkles, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TagSelectorProps {
  suggestedTags: string[];  // AI-suggested tag names
  selectedTags: string[];   // User-selected tag names
  onChange: (selected: string[]) => void;
  isAiLoading?: boolean;
}

export function TagSelector({
  suggestedTags,
  selectedTags,
  onChange,
  isAiLoading,
}: TagSelectorProps) {
  const [customTag, setCustomTag] = React.useState("");

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !selectedTags.includes(trimmedTag)) {
      onChange([...selectedTags, trimmedTag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onChange(selectedTags.filter((t) => t !== tag));
  };

  const handleAddCustomTag = () => {
    if (customTag.trim()) {
      handleAddTag(customTag.trim());
      setCustomTag("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomTag();
    }
  };

  const hasSuggestions = suggestedTags.length > 0;
  // Фильтруем предложенные теги, которые ещё не выбраны
  const availableSuggestions = suggestedTags.filter(tag => !selectedTags.includes(tag));

  return (
    <div className="space-y-3">
      <Label>Теги (генерируются AI)</Label>
      <p className="text-xs text-muted-foreground">
        Теги генерируются на основе названия документа и выбранных полей. Для точной классификации используйте понятные имена файлов.
      </p>
      
      {/* AI-подсказки тегов */}
      {(availableSuggestions.length > 0 || isAiLoading) && (
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
          {!isAiLoading && availableSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableSuggestions.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="cursor-pointer transition-all hover:scale-105 border-primary/50 text-primary hover:bg-primary/10"
                  onClick={() => handleAddTag(tag)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Выбранные теги */}
      {selectedTags.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Выбранные теги:</span>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <Badge
                key={tag}
                variant="default"
                className="bg-primary text-primary-foreground"
              >
                {tag}
                <X 
                  className="h-3 w-3 ml-1 cursor-pointer hover:opacity-70" 
                  onClick={() => handleRemoveTag(tag)}
                />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Добавление своего тега */}
      <div className="flex gap-2">
        <Input
          placeholder="Добавить свой тег..."
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-card"
        />
        <Button 
          type="button" 
          variant="outline" 
          size="icon"
          onClick={handleAddCustomTag}
          disabled={!customTag.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

    </div>
  );
}
