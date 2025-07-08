import { useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatParameters, PARAMETER_LIMITS, DEFAULT_PARAMETERS } from '@/types/openrouter';

interface ParameterControlsProps {
  parameters: ChatParameters;
  onParametersChange: (parameters: Partial<ChatParameters>) => void;
  disabled?: boolean;
  className?: string;
}

interface ParameterInfo {
  name: string;
  description: string;
  examples: string[];
}

const PARAMETER_INFO: Record<keyof Omit<ChatParameters, 'stream'>, ParameterInfo> = {
  temperature: {
    name: 'Temperature',
    description: 'Controls randomness in the output. Higher values make output more random, lower values make it more focused and deterministic.',
    examples: ['0.0 = Very focused', '0.7 = Balanced', '1.0 = Creative', '2.0 = Very random'],
  },
  max_tokens: {
    name: 'Max Tokens',
    description: 'The maximum number of tokens to generate in the response. One token is roughly 4 characters.',
    examples: ['512 = Short response', '1024 = Medium response', '2048 = Long response', '4096 = Very long response'],
  },
  top_p: {
    name: 'Top P',
    description: 'Controls diversity via nucleus sampling. Only tokens with cumulative probability up to this value are considered.',
    examples: ['0.1 = Very focused', '0.5 = Somewhat focused', '0.9 = Balanced', '1.0 = All tokens considered'],
  },
  frequency_penalty: {
    name: 'Frequency Penalty',
    description: 'Reduces repetition by penalizing tokens based on their frequency in the text so far.',
    examples: ['0.0 = No penalty', '0.5 = Moderate penalty', '1.0 = Strong penalty', '2.0 = Maximum penalty'],
  },
  presence_penalty: {
    name: 'Presence Penalty',
    description: 'Reduces repetition by penalizing tokens that have already appeared in the text.',
    examples: ['0.0 = No penalty', '0.5 = Moderate penalty', '1.0 = Strong penalty', '2.0 = Maximum penalty'],
  },
};

export default function ParameterControls({
  parameters,
  onParametersChange,
  disabled = false,
  className,
}: ParameterControlsProps) {
  const [showInfo, setShowInfo] = useState<string | null>(null);

  const handleParameterChange = (key: keyof ChatParameters, value: number) => {
    onParametersChange({ [key]: value });
  };

  const handleReset = () => {
    onParametersChange(DEFAULT_PARAMETERS);
  };

  const renderSlider = (
    key: keyof Omit<ChatParameters, 'stream'>,
    value: number,
    limits: { min: number; max: number; step: number }
  ) => {
    const percentage = ((value - limits.min) / (limits.max - limits.min)) * 100;
    const info = PARAMETER_INFO[key];

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">{info.name}</label>
            <button
              onClick={() => setShowInfo(showInfo === key ? null : key)}
              className="p-0.5 hover:bg-muted rounded transition-colors"
              disabled={disabled}
            >
              <Info className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          <span className="text-sm text-muted-foreground font-mono">
            {value}
          </span>
        </div>

        <div className="relative">
          <input
            type="range"
            min={limits.min}
            max={limits.max}
            step={limits.step}
            value={value}
            onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
            disabled={disabled}
            className={cn(
              'w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer',
              'slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4',
              'slider-thumb:rounded-full slider-thumb:bg-primary slider-thumb:cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={{
              background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) ${percentage}%, hsl(var(--muted)) 100%)`,
            }}
          />
        </div>

        {showInfo === key && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2 animate-in">
            <p className="text-xs text-muted-foreground">{info.description}</p>
            <div className="space-y-1">
              {info.examples.map((example, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  • {example}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Chat Parameters</h3>
        <button
          onClick={handleReset}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
            'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="space-y-4">
        {renderSlider('temperature', parameters.temperature, PARAMETER_LIMITS.temperature)}
        {renderSlider('max_tokens', parameters.max_tokens, PARAMETER_LIMITS.max_tokens)}
        {renderSlider('top_p', parameters.top_p, PARAMETER_LIMITS.top_p)}
        {renderSlider('frequency_penalty', parameters.frequency_penalty, PARAMETER_LIMITS.frequency_penalty)}
        {renderSlider('presence_penalty', parameters.presence_penalty, PARAMETER_LIMITS.presence_penalty)}
      </div>

      {/* Streaming Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Streaming</label>
          <input
            type="checkbox"
            checked={parameters.stream}
            onChange={(e) => onParametersChange({ stream: e.target.checked })}
            disabled={disabled}
            className="rounded border-border"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Enable real-time streaming of responses as they are generated.
        </p>
      </div>

      {/* Presets */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Presets</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              name: 'Balanced',
              params: { temperature: 0.7, top_p: 1.0, frequency_penalty: 0, presence_penalty: 0 },
            },
            {
              name: 'Creative',
              params: { temperature: 1.0, top_p: 0.9, frequency_penalty: 0.5, presence_penalty: 0.5 },
            },
            {
              name: 'Precise',
              params: { temperature: 0.1, top_p: 0.5, frequency_penalty: 0, presence_penalty: 0 },
            },
            {
              name: 'Diverse',
              params: { temperature: 0.8, top_p: 0.95, frequency_penalty: 1.0, presence_penalty: 1.0 },
            },
          ].map((preset) => (
            <button
              key={preset.name}
              onClick={() => onParametersChange(preset.params)}
              disabled={disabled}
              className={cn(
                'p-2 text-xs rounded-md border border-border transition-colors',
                'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
