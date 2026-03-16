import { useAppStore } from '../../stores/appStore';
import './index.css';

interface CommandHintPanelProps {
  onSelectHint: (command: string) => void;
}

const CommandHintPanel = ({ onSelectHint }: CommandHintPanelProps) => {
  const { commandHints, selectedHintIndex, clearCommandHints } = useAppStore();

  if (commandHints.length === 0) return null;

  const handleSelect = (command: string) => {
    // Clean up the command - remove placeholders like <package>
    const cleanCommand = command.replace(/\s*<[^>]+>/g, '');
    onSelectHint(cleanCommand);
    clearCommandHints();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      clearCommandHints();
    }
  };

  return (
    <div className="command-hint-panel" onKeyDown={handleKeyDown}>
      {commandHints.map((hint, index) => (
        <div
          key={index}
          className={`command-hint-item ${index === selectedHintIndex ? 'selected' : ''}`}
          onClick={() => handleSelect(hint.command)}
        >
          <span className="command-hint-command">{hint.command}</span>
          <span className="command-hint-description">{hint.description}</span>
        </div>
      ))}
    </div>
  );
};

export default CommandHintPanel;