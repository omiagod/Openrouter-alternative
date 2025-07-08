import { useState, useMemo } from 'react';
import { ChevronDown, Search, Zap, Clock, DollarSign, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelInfo, CategorizedModel } from '@/types/openrouter';
import LoadingSpinner from './LoadingSpinner';

interface ModelSelectorProps {
  selectedModel: string;
  availableModels: ModelInfo[];
  onModelChange: (modelId: string) => void;
  loading?: boolean;
  className?: string;
}

export default function ModelSelector({
  selectedModel,
  availableModels,
  onModelChange,
  loading = false,
  className,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Categorize and filter models
  const { categorizedModels, categories } = useMemo(() => {
    const categorized = availableModels.map(model => ({
      ...model,
      category: getModelCategory(model.id),
      featured: isFeaturedModel(model.id),
    })) as CategorizedModel[];

    const cats = ['all', ...Array.from(new Set(categorized.map(m => m.category)))];

    return {
      categorizedModels: categorized,
      categories: cats,
    };
  }, [availableModels]);

  // Filter models based on search and category
  const filteredModels = useMemo(() => {
    let filtered = categorizedModels;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(model => model.category === selectedCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(model =>
        model.name.toLowerCase().includes(query) ||
        model.id.toLowerCase().includes(query) ||
        model.description?.toLowerCase().includes(query)
      );
    }

    // Sort: featured first, then by name
    return filtered.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [categorizedModels, selectedCategory, searchQuery]);

  const selectedModelInfo = categorizedModels.find(m => m.id === selectedModel);

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        <label className="text-sm font-medium text-muted-foreground">
          Model
        </label>
        <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/50">
          <LoadingSpinner size="small" />
          <span className="text-sm text-muted-foreground">Loading models...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative space-y-2', className)}>
      <label className="text-sm font-medium text-muted-foreground">
        Model
      </label>
      
      {/* Selected Model Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between p-3 border border-border rounded-md',
          'bg-background hover:bg-muted/50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          isOpen && 'ring-2 ring-ring'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedModelInfo?.featured && (
            <Zap className="h-4 w-4 text-primary flex-shrink-0" />
          )}
          <div className="text-left min-w-0">
            <p className="text-sm font-medium truncate">
              {selectedModelInfo?.name || selectedModel}
            </p>
            {selectedModelInfo?.description && (
              <p className="text-xs text-muted-foreground truncate">
                {selectedModelInfo.description}
              </p>
            )}
          </div>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg">
          <div className="p-3 border-b border-border space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-md transition-colors',
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  )}
                >
                  {category === 'all' ? 'All' : category.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Models List */}
          <div className="max-h-80 overflow-y-auto">
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No models found matching your criteria
              </div>
            ) : (
              <div className="p-1">
                {filteredModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-md transition-colors',
                      'hover:bg-muted focus:outline-none focus:bg-muted',
                      selectedModel === model.id && 'bg-muted'
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {model.featured && (
                          <Zap className="h-3 w-3 text-primary" />
                        )}
                        <span className="text-sm font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.category}
                        </span>
                      </div>
                      
                      {model.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {model.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatNumber(model.context_length)} ctx</span>
                        </div>
                        
                        {model.pricing && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>${model.pricing.prompt}/1K</span>
                          </div>
                        )}
                        
                        {model.top_provider?.is_moderated && (
                          <div className="flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            <span>Moderated</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

// Helper functions
function getModelCategory(modelId: string): string {
  const id = modelId.toLowerCase();
  
  if (id.includes('gpt') || id.includes('openai')) return 'gpt';
  if (id.includes('claude') || id.includes('anthropic')) return 'claude';
  if (id.includes('gemini') || id.includes('google')) return 'gemini';
  if (id.includes('llama') || id.includes('meta')) return 'llama';
  if (id.includes('mistral')) return 'mistral';
  
  return 'other';
}

function isFeaturedModel(modelId: string): boolean {
  const featured = [
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'gemini-pro',
    'llama-3-70b',
  ];
  
  return featured.some(f => modelId.toLowerCase().includes(f));
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
