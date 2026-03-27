import { useState } from 'react';
import CalculatorTab from './components/CalculatorTab';
import BlueprintTab from './components/BlueprintTab';

type TabId = 'calculator' | 'blueprint';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'calculator', label: 'Калькулятор и Проектирование', icon: '⚙' },
  { id: 'blueprint', label: 'Чертёжная доска', icon: '📐' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('calculator');

  return (
    <div className="min-h-screen bg-cad-bg flex flex-col">
      {/* Шапка */}
      <header className="bg-cad-surface border-b border-cad-border px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Логотип и название */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-cad-accent to-cad-accent-2 rounded-lg flex items-center justify-center text-lg font-bold text-cad-bg shadow-lg shadow-cad-accent/20">
              🔪
            </div>
            <div>
              <h1 className="text-base font-bold text-cad-text leading-tight tracking-wide">
                АРМ Ножедела
              </h1>
              <p className="text-[10px] text-cad-text-dim tracking-widest uppercase">
                Knife Maker CAD · Grind Calculator
              </p>
            </div>
          </div>

          {/* Вкладки */}
          <nav className="flex gap-1 bg-cad-bg rounded-lg p-1 border border-cad-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-cad-accent/15 text-cad-accent shadow-sm border border-cad-accent/20'
                    : 'text-cad-text-dim hover:text-cad-text hover:bg-cad-surface-2 border border-transparent'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Версия */}
          <div className="text-[10px] text-cad-text-dim font-mono">
            v1.0.0
          </div>
        </div>
      </header>

      {/* Контент */}
      <main className="flex-1 p-5 overflow-hidden">
        {activeTab === 'calculator' && <CalculatorTab />}
        {activeTab === 'blueprint' && <BlueprintTab />}
      </main>

      {/* Футер */}
      <footer className="bg-cad-surface border-t border-cad-border px-6 py-2 flex items-center justify-between">
        <div className="text-[10px] text-cad-text-dim">
          АРМ Ножедела — Расчёт геометрии спусков для гриндера
        </div>
        <div className="flex items-center gap-4 text-[10px] text-cad-text-dim">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cad-accent-2 inline-block" />
            Готов к работе
          </span>
        </div>
      </footer>
    </div>
  );
}
