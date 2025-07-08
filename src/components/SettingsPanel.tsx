import { useState } from 'react';
import { X, Settings, Download, Upload, Trash2, Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserSettings } from '@/types/chat';
import ParameterControls from './ParameterControls';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSettingsChange: (settings: Partial<UserSettings>) => void;
  className?: string;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  className,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'parameters' | 'data'>('general');

  if (!isOpen) return null;

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    onSettingsChange({ theme });
    
    // Apply theme immediately
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  };

  const handleExportData = () => {
    // TODO: Implement data export
    console.log('Export data');
  };

  const handleImportData = () => {
    // TODO: Implement data import
    console.log('Import data');
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      // TODO: Implement data clearing
      console.log('Clear data');
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={cn(
        'fixed right-0 top-0 h-full w-96 bg-background border-l border-border z-50',
        'transform transition-transform duration-200 ease-in-out',
        className
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: 'general', label: 'General' },
              { id: 'parameters', label: 'Parameters' },
              { id: 'data', label: 'Data' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeTab === 'general' && (
              <>
                {/* Theme */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Theme</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'light', label: 'Light', icon: Sun },
                      { value: 'dark', label: 'Dark', icon: Moon },
                      { value: 'system', label: 'System', icon: Monitor },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => handleThemeChange(value as any)}
                        className={cn(
                          'flex flex-col items-center gap-2 p-3 rounded-md border transition-colors',
                          settings.theme === value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Font Size</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'small', label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large', label: 'Large' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => onSettingsChange({ fontSize: value as any })}
                        className={cn(
                          'p-2 text-sm rounded-md border transition-colors',
                          settings.fontSize === value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display Options */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Display</h3>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Show token count</span>
                      <input
                        type="checkbox"
                        checked={settings.showTokenCount}
                        onChange={(e) => onSettingsChange({ showTokenCount: e.target.checked })}
                        className="rounded border-border"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Show cost estimate</span>
                      <input
                        type="checkbox"
                        checked={settings.showCostEstimate}
                        onChange={(e) => onSettingsChange({ showCostEstimate: e.target.checked })}
                        className="rounded border-border"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Compact mode</span>
                      <input
                        type="checkbox"
                        checked={settings.compactMode}
                        onChange={(e) => onSettingsChange({ compactMode: e.target.checked })}
                        className="rounded border-border"
                      />
                    </label>
                  </div>
                </div>

                {/* Behavior */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Behavior</h3>
                  <div className="space-y-2">
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Auto-save conversations</span>
                      <input
                        type="checkbox"
                        checked={settings.autoSave}
                        onChange={(e) => onSettingsChange({ autoSave: e.target.checked })}
                        className="rounded border-border"
                      />
                    </label>
                    <label className="flex items-center justify-between">
                      <span className="text-sm">Enable sounds</span>
                      <input
                        type="checkbox"
                        checked={settings.enableSounds}
                        onChange={(e) => onSettingsChange({ enableSounds: e.target.checked })}
                        className="rounded border-border"
                      />
                    </label>
                  </div>
                </div>

                {/* Max Conversations */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Storage</h3>
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-sm">Max conversations to keep</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={settings.maxConversations}
                        onChange={(e) => onSettingsChange({ maxConversations: parseInt(e.target.value) })}
                        className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-background"
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'parameters' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Default Chat Parameters</h3>
                  <p className="text-xs text-muted-foreground">
                    These settings will be used for new conversations.
                  </p>
                </div>
                <ParameterControls
                  parameters={settings.defaultParameters}
                  onParametersChange={(params) => 
                    onSettingsChange({ 
                      defaultParameters: { ...settings.defaultParameters, ...params } 
                    })
                  }
                />
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                {/* Export/Import */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Backup & Restore</h3>
                  <div className="space-y-2">
                    <button
                      onClick={handleExportData}
                      className="w-full flex items-center gap-2 p-3 border border-border rounded-md hover:bg-muted transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-sm">Export conversations</span>
                    </button>
                    <button
                      onClick={handleImportData}
                      className="w-full flex items-center gap-2 p-3 border border-border rounded-md hover:bg-muted transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">Import conversations</span>
                    </button>
                  </div>
                </div>

                {/* Clear Data */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Clear Data</h3>
                  <button
                    onClick={handleClearData}
                    className="w-full flex items-center gap-2 p-3 border border-destructive text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="text-sm">Clear all data</span>
                  </button>
                  <p className="text-xs text-muted-foreground">
                    This will permanently delete all conversations, settings, and stored data.
                  </p>
                </div>

                {/* Storage Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Storage Information</h3>
                  <div className="p-3 bg-muted/50 rounded-md space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Conversations:</span>
                      <span>0 stored</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>Storage used:</span>
                      <span>~0 KB</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
