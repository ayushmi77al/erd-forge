export interface SDLError {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  offset?: number;
  message: string;
}
