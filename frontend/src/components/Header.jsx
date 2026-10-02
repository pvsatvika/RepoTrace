import React from 'react';
import LogoMark from './LogoMark';

export default function Header({
  repository,
  health,
  theme = 'dark',
  onToggleTheme,
  activeSection = 'explore',
  onNavigate,
  onOpenContact
}) {
  const isNeo4jConnected = health?.services?.neo4j?.connected;

  const navItems = [
    { id: 'explore', label: 'Home' },
    { id: 'how-it-works', label: 'About' },
    { id: 'history', label: 'History' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (id) => {
    if (id === 'contact') {
      if (onOpenContact) {
        onOpenContact();
      } else if (onNavigate) {
        onNavigate('contact');
      }
    } else if (onNavigate) {
      onNavigate(id);
    }
  };

  return (
    <header className="border-b border-theme bg-theme-header backdrop-blur-md px-6 sm:px-10 py-3.5 sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-6">
        
        {/* BRAND IDENTITY */}
        <div 
          onClick={() => onNavigate && onNavigate('explore')}
          className="group flex items-center gap-3 cursor-pointer select-none"
        >
          <LogoMark size={30} />
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-theme-primary font-mono group-hover:text-[var(--accent-blue)] transition-colors">
            WhyTheCodeIsLikeThis
          </h1>

          {repository && (
            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-theme text-xs font-mono text-theme-muted">
              <span className="text-[10px] uppercase tracking-wider text-theme-muted">Target:</span>
              <span className="font-bold text-[var(--accent-blue)]">{repository}</span>
            </div>
          )}
        </div>

        {/* CENTER NAVIGATION & RIGHT THEME TOGGLE */}
        <div className="flex items-center gap-6 sm:gap-8">
          
          <nav className="flex items-center gap-6 text-sm font-sans font-medium">
            {navItems.map((item) => {
              const isActive = activeSection === item.id || (item.id === 'explore' && activeSection === 'explore');
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`transition-all duration-150 cursor-pointer text-sm font-medium relative py-1 ${
                    isActive
                      ? 'text-[var(--accent-blue)] font-bold'
                      : 'text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-blue)] rounded-full transition-all duration-200" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* STATUS INDICATOR (OPTIONAL / COMPACT) */}
          {health && (
            <div className="hidden xl:flex items-center gap-2 text-xs font-mono px-2.5 py-1 rounded-md bg-theme-card border border-theme text-theme-muted">
              <span className={`w-2 h-2 rounded-full ${isNeo4jConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span>Engine: {isNeo4jConnected ? 'Ready' : 'Offline'}</span>
            </div>
          )}

          {/* THEME TOGGLE SWITCH */}
          <button
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="relative inline-flex items-center h-8 w-16 rounded-full p-1 transition-colors duration-200 cursor-pointer border border-theme bg-theme-card focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/40"
          >
            {/* SUN ICON (LEFT) */}
            <span className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
              theme === 'light' ? 'text-amber-500 bg-white shadow-xs font-bold scale-110' : 'text-theme-muted'
            }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </span>

            {/* MOON ICON (RIGHT) */}
            <span className={`ml-auto flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
              theme === 'dark' ? 'text-indigo-400 bg-[#121e36] shadow-xs font-bold scale-110' : 'text-theme-muted'
            }`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </span>
          </button>

        </div>

      </div>
    </header>
  );
}
