import { useState } from 'react';

export default function Tabs({ 
  tabs, 
  defaultTab, 
  onChange, 
  className = '',
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  return (
    <div className={className}>
      {/* Tambahin w-full di div ini biar tablist-nya mentok kiri-kanan */}
      <div className="flex w-full border-b border-border mb-4" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => {
              setActiveTab(tab.id);
              onChange?.(tab.id);
            }}
            // Tambahin flex-1 di sini biar lebarnya kebagi rata
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors text-center ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-border'
            } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {tabs.find(t => t.id === activeTab)?.content}
      </div>
    </div>
  );
}