import { useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ChipsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ChipsInput({ 
  value, 
  onChange, 
  placeholder = "Digite e pressione Enter para adicionar", 
  className = "",
  disabled = false 
}: ChipsInputProps) {
  const [inputValue, setInputValue] = useState("");

  const normalizeString = (str: string) => {
    return str.trim().toLowerCase();
  };

  const addChip = (text: string) => {
    const normalizedText = text.trim();
    if (!normalizedText) return;
    
    const normalizedInput = normalizeString(normalizedText);
    const isDuplicate = value.some(chip => normalizeString(chip) === normalizedInput);
    
    if (!isDuplicate) {
      onChange([...value, normalizedText]);
    }
    setInputValue("");
  };

  const removeChip = (index: number) => {
    const newValue = value.filter((_, i) => i !== index);
    onChange(newValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      e.preventDefault();
      removeChip(value.length - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        data-testid="chips-input"
      />
      
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1" data-testid="chips-container">
          {value.map((chip, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="flex items-center gap-1 pr-1"
              data-testid={`chip-${index}`}
            >
              <span>{chip}</span>
              <button
                type="button"
                onClick={() => removeChip(index)}
                disabled={disabled}
                className="hover:bg-gray-500/20 rounded-full p-0.5"
                data-testid={`chip-remove-${index}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}