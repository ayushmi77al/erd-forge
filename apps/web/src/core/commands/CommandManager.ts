import { Command } from './Command';

export class CommandManager {
  private history: Command[] = [];
  private currentPosition: number = -1;
  private maxHistory: number;

  constructor(maxHistory: number = 1000) {
    this.maxHistory = maxHistory;
  }

  push(command: Command): Command {
    // If we're not at the end of history, truncate the future
    if (this.currentPosition < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentPosition + 1);
    }
    
    this.history.push(command);
    
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentPosition++;
    }
    
    return command;
  }

  undo(): Command | null {
    if (this.currentPosition >= 0) {
      const command = this.history[this.currentPosition];
      this.currentPosition--;
      return command || null;
    }
    return null;
  }

  redo(): Command | null {
    if (this.currentPosition < this.history.length - 1) {
      this.currentPosition++;
      const command = this.history[this.currentPosition];
      return command || null;
    }
    return null;
  }

  get canUndo(): boolean {
    return this.currentPosition >= 0;
  }

  get canRedo(): boolean {
    return this.currentPosition < this.history.length - 1;
  }
  
  get undoDescription(): string | null {
    return this.canUndo ? (this.history[this.currentPosition]?.description || null) : null;
  }
  
  get redoDescription(): string | null {
    return this.canRedo ? (this.history[this.currentPosition + 1]?.description || null) : null;
  }
}
